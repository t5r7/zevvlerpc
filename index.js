console.log('Unofficial Zevvle Discord RPC by TomR.me\nhttps://github.com/tomfishemoji/zevvlerpc');

const config = require('./config.json')
const clientId = config.clientID;

const DiscordRPC = require('discord-rpc');
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

const fetch = require('node-fetch');

async function getZdata(endpoint) {
    // console.log(`making a request to the big Z, ${endpoint}`);
    let res = await fetch(`https://api.zevvle.com/${endpoint}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${config.zSecret}` }
    });
    // console.log('request is OVER. let\'s return the response now');
    return res.json();

    // console.log(await res.json());
}


async function showUsage(whatToShow) {
    if (!['data', 'callstexts'].includes(whatToShow)) return console.log('unknown usage type (should be data/callstexts)');

    console.log(`showing ${whatToShow}`);

    let activeCardCount = 0, totalCardCount = 0, activeCardNames = '';
    let monthCalls = 0, monthCallDuration = 0, monthSMS = 0, monthMMS = 0, monthDataBytes = 0;

    // first and last day of current month
    // https://stackoverflow.com/a/13572682
    let now = new Date();
    let f = new Date(now.getFullYear(), now.getMonth(), 1);
    let l = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let simCards = await getZdata('sim_cards');

    for (let card of simCards) {
        // console.log('found a card');
        totalCardCount++;
        if (card.status == 'active') {
            // console.log('sim was active');
            activeCardCount++;
            activeCardNames += `${card.name}, `
        }

        let commonQuery = `call_records?sim_card_id=${card.id}&after=${f.toISOString()}&before=${l.toISOString()}&limit=100`;

        if (whatToShow == 'data') {
            await getZdata(`${commonQuery}&type=data`).then(dataRecords => {
                for (let d of dataRecords) {
                    if (!d.duration) continue;
                    if (d.simple_type !== 'data') continue;
                    monthDataBytes += d.duration;
                }
            });
        } else if (whatToShow == 'callstexts') {
            await getZdata(`${commonQuery}&type[]=voice&type[]=sms&type[]=mms`).then(dataRecords => {
                for (let d of dataRecords) {
                    if (d.simple_type == 'data') continue;

                    if (d.simple_type == 'sms') monthSMS++;
                    if (d.simple_type == 'mms') monthMMS++;
                    if (d.simple_type == 'voice') {
                        monthCallDuration += d.duration;
                        monthCalls++;
                    }
                }
            });
        }
    }

    let cardsPlural = (activeCardCount > 1) ? 's' : '';
    let textsPlural = (monthSMS + monthMMS > 1) ? 's' : '';
    let callsPlural = (monthCalls > 1) ? 's' : '';

    let monthDataMegabytes = monthDataBytes / 1000000;
    let monthDataMegabytesRounded = parseFloat(monthDataMegabytes).toFixed(0);

    let monthDataGigabytes = monthDataBytes / 1000000000;
    let monthDataGigabytesRounded = parseFloat(monthDataGigabytes).toFixed(2);

    let activeCardCountText = 'Unknown';
    switch (activeCardCount) {
        case 0:
            activeCardCountText = 'Zero';
            break;
        case 1:
            activeCardCountText = 'One';
            break;
        case 2:
            activeCardCountText = 'Two';
            break;
        case 3:
            activeCardCountText = 'Three';
            break;
        case 4:
            activeCardCountText = 'Four';
            break;
        case 5:
            activeCardCountText = 'Five';
            break;
        default:
            activeCardCountText = 'Unknown';
    }

    activeCardNames = activeCardNames.substring(0, activeCardNames.length - 2);

    let refCode = config.zReferralCode || '';
    let details, state;

    if (whatToShow == 'data') {
        details = '🌐 Used at least ';
        if(config.dataUnits.toUpperCase() == 'GB') {
            details += `${monthDataGigabytesRounded}GB`;
        } else {
            details += `${monthDataGigabytesRounded}MB`;
        }
        details += ' this month';
        state = `🔢 ${activeCardCountText} active SIM card${cardsPlural}`;
    } else if (whatToShow == 'callstexts') {
        details = `💬 Sent at least ${monthSMS} SMS, ${monthMMS} MMS message${textsPlural}`;
        state = `📞 Spent ${monthCallDuration}s in ${monthCalls} call${callsPlural} this month`;
    } else {
        details, state = '?';
    }

    let activity = {
        details,
        state,
        largeImageKey: `z_zed`,
        largeImageText: `Unofficial Zevvle RPC (TomR.me)`,
        smallImageKey: `sim_card`,
        smallImageText: `${activeCardCount} Active SIM${cardsPlural}: ${activeCardNames}`,
        partyId: "zevvle_pages",
        partySize: currentFrame+1,
        partyMax: 2,
        buttons: [
            { 'label': 'Join Zevvle', 'url': `https://join.zevvle.com/${refCode}` }
        ]
    }

    console.log('setting discord status');
    rpc.setActivity(activity);
}

let currentFrame = 0;

rpc.on('ready', () => {
    console.log('we connected to discord a-okay');

    showUsage('data');
    currentFrame = 1;

    setInterval(() => {
        console.log(`\nran due to interval - current frame is ${currentFrame}`);
        switch (currentFrame) {
            case 0:
                showUsage('data');
                currentFrame = 1;
                break;
            case 1:
                showUsage('callstexts');
                currentFrame = 0;
                break;
        }
    }, 1000 * parseInt(config.updateInt));
});


rpc.login({ clientId }).catch(console.error);