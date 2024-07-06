document.addEventListener('DOMContentLoaded', async () => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
    }
    await checkTicketClaimStatus();
});

async function checkTicketClaimStatus() {
    const userInfo = document.getElementById('userInfo').textContent;
    try {
        const response = await fetch(`/getUserData?username=${encodeURIComponent(userInfo)}`);
        const data = await response.json();
        console.log('User data received:', data);

        if (data.success) {
            const ticketsInfo = document.getElementById('ticketsInfo');
            ticketsInfo.textContent = `${data.tickets}`;

            const pointsInfo = document.getElementById('points');
            pointsInfo.textContent = `${data.points}`;

            // Ensure the server correctly reflects ticket claiming status
            console.log('Has claimed tickets:', data.has_claimed_tickets);

            if (!data.has_claimed_tickets) {
                document.getElementById('claimPopup').style.display = 'flex';
            } else {
                document.getElementById('claimPopup').style.display = 'none'; // Ensure popup is hidden if tickets are already claimed
            }
        } else {
            console.error('Failed to fetch user data:', data.error);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

async function claimTickets() {
    const userInfo = document.getElementById('userInfo').textContent;
    try {
        const response = await fetch('/claimTickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userInfo })
        });
        const data = await response.json();

        if (data.success) {
            alert('Tickets claimed successfully!');
            document.getElementById('ticketsInfo').textContent = `${data.tickets}`;
            document.getElementById('claimPopup').style.display = 'none';
            
            // Update local UI and possibly trigger other updates
            const event = new CustomEvent('ticketsUpdated', { detail: { tickets: data.tickets } });
            document.dispatchEvent(event);
            
            // Reload ticket claiming status after claiming
            await checkTicketClaimStatus();
        } else {
            alert(data.message);
            document.getElementById('claimPopup').style.display = 'none';
        }
    } catch (error) {
        console.error('Error claiming tickets:', error);
        alert('Failed to claim tickets. Please try again later.');
    }
}

function closePopup() {
    document.getElementById('claimPopup').style.display = 'none';
}


async function showReferralLink() {
    const userInfo = document.getElementById('userInfo').textContent;
    try {
        const response = await fetch(`/getReferralLink?username=${encodeURIComponent(userInfo)}`);
        const data = await response.json();

        if (data.success) {
            const referralLink = `https://t.me/melodymint_bot?start=${data.authCode}`;

            // Display modal with referral link
            const modal = document.getElementById('myModal');
            const modalContent = document.getElementById('modalContent');
            const friendsInvited = document.getElementById('friendsInvited');
            modal.style.display = 'block';
            modalContent.textContent = referralLink;

            // Automatically copy to clipboard for mobile
            const dummyInput = document.createElement('input');
            document.body.appendChild(dummyInput);
            dummyInput.value = referralLink;
            dummyInput.select();
            document.execCommand('copy');
            document.body.removeChild(dummyInput);

            // Display number of friends invited
            friendsInvited.textContent = `Friends invited: ${data.friendsInvited}`;
        } else {
            console.error('Failed to fetch referral link:', data.error);
        }
    } catch (error) {
        console.error('Error fetching referral link:', error);
    }
}

function closeModal() {
    const modal = document.getElementById('myModal');
    modal.style.display = 'none';
}

function copyToClipboard() {
    const referralLink = document.getElementById('modalContent').textContent;
    const dummyInput = document.createElement('input');
    document.body.appendChild(dummyInput);
    dummyInput.value = referralLink;
    dummyInput.select();
    document.execCommand('copy');
    document.body.removeChild(dummyInput);
    alert('Referral link copied to clipboard!');
}
