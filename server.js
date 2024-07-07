const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment-timezone');
const crypto = require('crypto');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your bot token
const token = process.env.BOT_TOKEN || '6750160592:AAGxbke78fBFSJ5nUkEBcSQErMqntgaDwCY';
const miniAppUrl = 'https://melodymint-37ad5073fe0d.herokuapp.com/'; 
const imagePath = 'photo1.jpg';  // Replace with the actual path to your image
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});
bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.code);
});

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Connect to PostgreSQL
pool.connect((err, client, done) => {
    if (err) {
        throw err;
    }
    console.log('Connected to PostgreSQL...');
    done();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Generate auth code
const generateAuthCode = () => {
    return crypto.randomBytes(8).toString('hex');
};

// Generate unique Telegram ID
const generateTelegramId = () => {
    return crypto.randomBytes(8).toString('hex');
};

// Insert user and referral function
const insertUserAndReferral = async (username) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if the user already exists
        const checkUserQuery = 'SELECT * FROM users WHERE username = $1';
        const checkUserResult = await client.query(checkUserQuery, [username]);

        if (checkUserResult.rows.length > 0) {
            // User already exists, handle appropriately (maybe throw an error or update existing user)
            console.log(`User with username ${username} already exists.`);
            return { userExists: true };
        }

        // User does not exist, proceed with insertion
        const insertQuery = `
            INSERT INTO users (username, points, tickets, referral_link, friends_invited)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING user_id, points, tickets
        `;
        const insertValues = [username, 0, 100, '', 0]; // No referralLink needed initially
        const insertResult = await client.query(insertQuery, insertValues);

        const userId = insertResult.rows[0].user_id;
        const userReferralLink = `ref${userId}`;
        const authCode = generateAuthCode();

        await client.query('UPDATE users SET referral_link = $1, auth_code = $2 WHERE user_id = $3', [userReferralLink, authCode, userId]);

        console.log(`New user created with ID: ${userId}, referral link: ${userReferralLink}, auth code: ${authCode}`);

        await client.query('COMMIT');
        return { ...insertResult.rows[0], authCode };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in insertUserAndReferral:', error);
        throw error;
    } finally {
        client.release();
    }
};


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    try {
        const client = await pool.connect();
        const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);

        if (existingUser.rows.length === 0) {
            // User does not exist, insert new user
            const referralLink = ''; // No referral link on initial bot start
            const newUser = await insertUserAndReferral(username, referralLink);

            // Update the chat ID for the new user
            await client.query('UPDATE users SET chat_id = $1 WHERE username = $2', [chatId, username]);
            console.log(`New user saved: ${username} (Telegram ID: ${chatId})`);
        } else {
            // User exists, update their Telegram ID if not already set
            const existingChatId = existingUser.rows[0].chat_id;
            if (!existingChatId) {
                await client.query('UPDATE users SET chat_id = $1 WHERE username = $2', [chatId, username]);
                console.log(`Updated chat ID for user: ${username} (Telegram ID: ${chatId})`);
            }
        }

        client.release();
    } catch (error) {
        console.error('Error saving user on bot start or message event:', error);
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    // Log the received message
    console.log(`Received message from ${username} (ID: ${chatId}): ${msg.text}`);

    // Options for the message and the image
    const options = {
        caption: `🎵 MelodyMint Revolution 🎵

🌟 We are transforming how the world interacts with music by integrating it with Web3 technologies. 🌟

💥 What We're Doing:

Tokens: Earn and trade tokens by interacting with music like never before.
Web3 Integration: Transfer your music into the blockchain, giving sound a real money value.

🎟️ Don't forget: You earn 10 tickets every day for playing the game! 🎟️`,
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Play and Earn', url: 'https://t.me/melodymint_bot/melodymint' }],  // Replace with your actual mini app URL
                [{ text: 'Join our community', url: 'https://t.me/melodymint_web3' }]  // Replace with your actual Telegram channel URL
            ]
        }
    };

    // Send the image with the caption and inline keyboard
    bot.sendPhoto(chatId, imagePath, options, (error, result) => {
        if (error) {
            console.error(`Error sending photo: ${error}`);
        } else {
            console.log(`Photo sent successfully to ${username}`);
        }
    });
});



// Set default timezone to Chisinau
moment.tz.setDefault('Europe/Chisinau');

// Define function to fetch and save chat IDs
const fetchAndSaveChatIds = async () => {
    try {
        const client = await pool.connect();

        // Query users without chat IDs
        const getUsersQuery = 'SELECT username FROM users WHERE chat_id IS NULL';
        const usersResult = await client.query(getUsersQuery);

        // Iterate over users and fetch chat IDs
        for (let user of usersResult.rows) {
            const username = user.username;

            // Fetch chat ID using Telegram API
            const telegramUser = await bot.getChat(username);

            if (telegramUser && telegramUser.id) {
                const chatId = telegramUser.id;

                // Update chat ID in the database
                const updateQuery = 'UPDATE users SET chat_id = $1 WHERE username = $2';
                await client.query(updateQuery, [chatId, username]);

                console.log(`Chat ID updated for ${username}: ${chatId}`);
            } else {
                console.log(`Failed to fetch chat ID for ${username}`);
            }
        }

        client.release();
    } catch (error) {
        console.error('Error fetching and saving chat IDs:', error);
    }
};

cron.schedule('* * * * *', async () => {
    console.log('Cron job running every minute...');
});


app.get('/getUserData', async (req, res) => {
    try {
        const { username, referralLink } = req.query;

        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const client = await pool.connect();
        const result = await client.query('SELECT user_id, points, tickets, has_claimed_tickets FROM users WHERE username = $1', [username]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.status(200).json({ success: true, points: user.points, tickets: user.tickets, has_claimed_tickets: user.has_claimed_tickets });
        } else {
            const newUser = await insertUserAndReferral(username, referralLink);
            res.status(200).json({ success: true, points: newUser.points, tickets: newUser.tickets, has_claimed_tickets: newUser.has_claimed_tickets });
        }

        client.release();
    } catch (err) {
        console.error('Error in getUserData endpoint:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/getReferralLink', async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const client = await pool.connect();
        const result = await client.query('SELECT referral_link, auth_code, friends_invited FROM users WHERE username = $1', [username]);

        if (result.rows.length > 0) {
            const referralLink = result.rows[0].referral_link;
            const authCode = result.rows[0].auth_code;
            const friendsInvited = result.rows[0].friends_invited;
            res.status(200).json({ success: true, referralLink, authCode, friendsInvited });
        } else {
            res.status(404).json({ success: false, error: 'Referral link not found for the user' });
        }

        client.release();
    } catch (err) {
        console.error('Error fetching referral link:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Endpoint to fetch top users
app.get('/topUsers', async (req, res) => {
    try {
        const topUsers = await fetchTopUsersFromDatabase();
        res.status(200).json(topUsers);
    } catch (error) {
        console.error('Error fetching top users:', error);
        res.status(500).json({ error: 'Failed to fetch top users' });
    }
});

async function fetchTopUsersFromDatabase() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT username, points FROM users ORDER BY points DESC LIMIT 10');
        return result.rows;
    } finally {
        client.release();
    }
}

// Endpoint to handle saving Telegram usernames and points
app.post('/saveUser', async (req, res) => {
    const { username, points } = req.body;

    if (!username || points === undefined) {
        return res.status(400).send('Username and points are required');
    }

    try {
        const client = await pool.connect();
        const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);

        if (existingUser.rows.length > 0) {
            // User exists, update points
            const updateQuery = 'UPDATE users SET points = points + $1 WHERE username = $2 RETURNING points, tickets';
            const updateValues = [points, username];
            const result = await client.query(updateQuery, updateValues);
            client.release();
            res.status(200).json({ success: true, points: result.rows[0].points, tickets: result.rows[0].tickets });


        } else {
            // User does not exist, insert new user
            const insertQuery = 'INSERT INTO users (username, points, tickets) VALUES ($1, $2, $3) RETURNING points, tickets';
            const insertValues = [username, points, 100]; // Default tickets set to 100
            const result = await client.query(insertQuery, insertValues);
            client.release();
            res.status(200).json({ success: true, points: result.rows[0].points, tickets: result.rows[0].tickets });
        }
    } catch (err) {
        console.error('Error saving user:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint to update tickets
app.post('/updateTickets', async (req, res) => {
    const { username, tickets } = req.body;

    if (!username || tickets === undefined) {
        return res.status(400).send('Username and tickets are required');
    }

    try {
        const client = await pool.connect();
        const updateQuery = 'UPDATE users SET tickets = $1 WHERE username = $2 RETURNING *';
        const updateValues = [tickets, username];
        const result = await client.query(updateQuery, updateValues);
        client.release();

        if (result.rows.length > 0) {
            res.status(200).json({ success: true, data: result.rows[0] });

        } else {
            res.status(404).json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        console.error('Error updating tickets:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Set default timezone to Chisinau
moment.tz.setDefault('Europe/Chisinau');

cron.schedule('33 15 * * *', async () => {
  console.log('Cron job triggered at 15:05 Chisinau time.');

  try {
    const client = await pool.connect();
    
    // Fetch all users who have a chat ID
    const getUsersQuery = 'SELECT chat_id FROM users WHERE chat_id IS NOT NULL';
    const usersResult = await client.query(getUsersQuery);

    const message = `🎟️ Don't forget to claim your free 10 tickets today! 🎟️`;
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Claim Now', url: 'https://t.me/melodymint_bot/melodymint' }]
        ]
      }
    };

    usersResult.rows.forEach(user => {
      const chatId = user.chat_id;
      // Send the message using the Telegram bot instance
      bot.sendMessage(chatId, message, options)
        .then(() => console.log(`Message sent to user with chat ID ${chatId}`))
        .catch(err => console.error(`Error sending message to user with chat ID ${chatId}:`, err));
    });

    client.release();
  } catch (error) {
    console.error('Error in cron job:', error);
  }
}, {
  timezone: 'Europe/Chisinau'
});



app.post('/claimTickets', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send('Username is required');
    }

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT tickets, has_claimed_tickets FROM users WHERE username = $1', [username]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.has_claimed_tickets) {
                res.status(400).json({ success: false, message: 'Tickets already claimed for today' });
            } else {
                const updateQuery = 'UPDATE users SET tickets = tickets + 10, has_claimed_tickets = TRUE WHERE username = $1 RETURNING tickets';
                const updateResult = await client.query(updateQuery, [username]);
                res.status(200).json({ success: true, tickets: updateResult.rows[0].tickets });
            }
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }

        client.release();
    } catch (err) {
        console.error('Error claiming tickets:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});



bot.onText(/\/start (.+)/, async (msg, match) => {
    const authCode = match[1];
    const username = msg.from.username; // Get the Telegram username of the current user
    const chatId = msg.chat.id; // Get the chat ID

    console.log(`Received /start command with authCode: ${authCode}`);
           
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT user_id, referral_link, username FROM users WHERE auth_code = $1', [authCode]);

        if (result.rows.length > 0) {
            const referrer = result.rows[0];

            // Check if the user already exists in the database
            const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);

            if (existingUser.rows.length > 0) {
                // User already exists, inform them that they cannot be referred
                bot.sendMessage(chatId, `You are already a registered user and cannot be referred.`);
            } else {
                // Insert the new user
                const insertQuery = `
                    INSERT INTO users (username, points, tickets, referral_link, friends_invited)
                    VALUES ($1, $2, $3, '', 0)  -- Empty referral link and 0 friends invited initially
                    RETURNING user_id, points, tickets
                `;
                const insertValues = [username, 0, 100];
                const newUserResult = await client.query(insertQuery, insertValues);
                const newUser = newUserResult.rows[0];

                // Increment friends_invited for the referrer
                await client.query('UPDATE users SET friends_invited = friends_invited + 1 WHERE user_id = $1', [referrer.user_id]);
                console.log(`Incremented friends_invited for referrer with ID ${referrer.user_id}`);

                // Send a personalized welcome message to the new user
                bot.sendMessage(chatId, `Welcome, ${username}! You've successfully joined via referral.`);
                
                // If there's a referrer, inform the new user about their referrer
                if (referrer.username) {
                    bot.sendMessage(chatId, `You were referred by user: ${referrer.username}`);
                    
                    // Update the referral_username field for the new user
                    const updateReferralUsernameQuery = 'UPDATE users SET referral_username = $1 WHERE user_id = $2';
                    await client.query(updateReferralUsernameQuery, [referrer.username, newUser.user_id]);
                }

                // Update the auth code for the new user
                const authCodeUpdateQuery = 'UPDATE users SET auth_code = $1 WHERE user_id = $2';
                const newAuthCode = generateAuthCode(); // Generate a new auth code for security reasons
                await client.query(authCodeUpdateQuery, [newAuthCode, newUser.user_id]);
            }
        } else {
            // If the auth code doesn't match, or if the user doesn't exist in the database
            bot.sendMessage(chatId, `Invalid referral link.`);
        }

        client.release();
    } catch (error) {
        console.error('Error processing /start command:', error);
        bot.sendMessage(chatId, 'An error occurred while processing your request. Please try again later.');
    }
});



// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
