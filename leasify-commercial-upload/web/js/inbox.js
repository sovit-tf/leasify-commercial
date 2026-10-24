/* =====================================================================
   Leasify Commercial demo: LEAD INBOX
   WhatsApp AI leasing agent (deterministic), lead simulator, handoff queue,
   conversation UI and the "Test as an occupier" phone.
   Owns: LC.openLead, LC.sim, view 'inbox'. Lead objects live in LC.state.leads.
   REMOTE MODE (server build, LC.remote is true): the engine in this file never runs in the browser. Every action
   (simulator, take over, hand back, send, pick up, "Test as an occupier") is a call to the server, which runs the same
   engine and publishes the result; the screen re-renders from the live patches (see net.js). Offline mode is unchanged.
   NOTE: Hindi and Odia message lines need a native speaker's review before a client demo.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;
const isRemote = () => !!LC.remote;            // the server runs the engine; this page only shows it and sends actions

/* ---------------- constants ---------------- */
const LK = (lead) => ({ English: 'en', Hindi: 'hi', Odia: 'od' }[lead.language] || 'en');
const LANG_TAG = { English: 'English', Hindi: 'Hindi', Odia: 'Odia' };
const SLA_SCALE = 10;                    // demo clock: 1 simulated second = 10 desk seconds (15 min SLA = 90 s at 1x)
const NUDGE_H_MS = 25000 / 24;           // demo clock: 24 hours of silence = 25 seconds
const ME_SENIOR = 'Rohit Mohanty';
const GENDER = { 'Rohit': 'm', 'Priyanka': 'f', 'Subham': 'm', 'Ananya': 'f', 'Satya': 'm' };
const STATUS_LABEL = { ai: 'AI handling', handoff: 'Needs a person', human: 'Person active', booked: 'Visit booked', nurture: 'Nurture', closed: 'Closed' };
const first = (name) => String(name || '').split(' ')[0];
const ruleOn = (id) => { const r = LC.settings().handoffRules.find(h => h.id === id); return !!(r && r.on); };
const ruleDef = (id) => LC.settings().handoffRules.find(h => h.id === id) || { id, name: id, trigger: '', action: '' };

/* own deterministic random (so a run after "Reset demo data" repeats) */
let rngState = 7001;
const rng = () => { rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0; let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rpick = (a) => a[Math.floor(rng() * a.length)];
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const rchance = (p) => rng() < p;
const rshuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wpick = (arr) => { const tot = LC.sum(arr, x => x[1]); let r = rng() * tot; for (const [v, w] of arr) { if ((r -= w) <= 0) return v; } return arr[0][0]; };

const DIG = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9, '୦': 0, '୧': 1, '୨': 2, '୩': 3, '୪': 4, '୫': 5, '୬': 6, '୭': 7, '୮': 8, '୯': 9 };
const normDigits = (s) => String(s || '').replace(/[०-९୦-୯]/g, c => DIG[c]);

/* ---------------- display values in each language ---------------- */
const USE_NAME = {
  en: { Office: 'Office', Coworking: 'Coworking', Retail: 'Retail shop', Showroom: 'Showroom', 'F&B': 'Restaurant or cafe', Clinic: 'Clinic', Institutional: 'Coaching or training centre', Warehouse: 'Warehouse', Industrial: 'Workshop or shed' },
  hi: { Office: 'ऑफिस', Coworking: 'कोवर्किंग', Retail: 'दुकान', Showroom: 'शोरूम', 'F&B': 'रेस्टोरेंट या कैफे', Clinic: 'क्लिनिक', Institutional: 'कोचिंग या ट्रेनिंग सेंटर', Warehouse: 'गोदाम', Industrial: 'वर्कशॉप या शेड' },
  od: { Office: 'ଅଫିସ', Coworking: 'କୋୱର୍କିଂ', Retail: 'ଦୋକାନ', Showroom: 'ସୋରୁମ', 'F&B': 'ରେଷ୍ଟୁରାଣ୍ଟ କିମ୍ବା କାଫେ', Clinic: 'କ୍ଲିନିକ', Institutional: 'କୋଚିଂ କିମ୍ବା ଟ୍ରେନିଂ ସେଣ୍ଟର', Warehouse: 'ଗୋଦାମ', Industrial: 'ୱାର୍କସପ୍ କିମ୍ବା ଶେଡ୍' },
};
const FURN_NAME = {
  en: { 'Plug-and-play': 'Plug-and-play', 'Semi-furnished': 'Semi-furnished', 'Warm shell': 'Warm shell', 'Bare shell': 'Bare shell (own interiors)' },
  hi: { 'Plug-and-play': 'तैयार (plug-and-play)', 'Semi-furnished': 'सेमी-फर्निश्ड', 'Warm shell': 'Warm shell', 'Bare shell': 'खुद का इंटीरियर' },
  od: { 'Plug-and-play': 'ପ୍ରସ୍ତୁତ (plug-and-play)', 'Semi-furnished': 'ସେମି-ଫର୍ନିସ୍ଡ', 'Warm shell': 'Warm shell', 'Bare shell': 'ନିଜ ଇଣ୍ଟେରିଅର' },
};
function valText(key, req, lk) {
  switch (key) {
    case 'use': return (USE_NAME[lk][req.use]) || req.use;
    case 'size': {
      if (req.seats && !req.sizeMin) return req.seats + ' ' + ({ en: 'seats', hi: 'सीट', od: 'ସିଟ୍' }[lk]);
      const b = LC.reqSizeBand(req); return b ? LC.fmtNum(b[0]) + '–' + LC.fmtNum(b[1]) + ' sq ft' : '';
    }
    case 'budget': {
      if (req.budgetPsf) return '₹' + req.budgetPsf + '/sq ft ' + ({ en: 'all-in', hi: '(सब मिलाकर)', od: '(ସବୁ ମିଶାଇ)' }[lk]);
      return LC.fmtLakh(req.budgetMonthly) + ' ' + ({ en: 'a month all-in', hi: 'प्रति माह (सब मिलाकर)', od: 'ପ୍ରତି ମାସ (ସବୁ ମିଶାଇ)' }[lk]);
    }
    case 'location': return req.localities.length ? req.localities.join(', ') : req.landmark ? req.landmark.name : req.city || '';
    case 'moveIn': return ({ en: 'move-in by ' + LC.fmtDate(req.moveIn), hi: LC.fmtDate(req.moveIn) + ' तक शिफ्ट', od: LC.fmtDate(req.moveIn) + ' ସୁଦ୍ଧା ଆରମ୍ଭ' }[lk]);
    case 'furnishing': return FURN_NAME[lk][req.furnishing] || req.furnishing;
    case 'parking4w': return req.parking4w ? req.parking4w + ' ' + ({ en: 'car parks', hi: 'कार पार्किंग', od: 'କାର ପାର୍କିଂ' }[lk]) : ({ en: 'no parking', hi: 'पार्किंग नहीं', od: 'ପାର୍କିଂ ନାହିଁ' }[lk]);
  }
  return '';
}
const numList = (n, lk) => { const or = { en: 'or', hi: 'या', od: 'କିମ୍ବା' }[lk]; const a = Array.from({ length: n }, (_, i) => i + 1); return a.length === 1 ? '1' : a.slice(0, -1).join(', ') + ' ' + or + ' ' + a[a.length - 1]; };

/* ---------------- message lines: English, Hindi, Odia ---------------- */
const TXT = {
  en: {
    greet: (n) => `Hello${n ? ' ' + n : ''}! This is the Leasify Commercial desk. We help businesses find office, shop and warehouse space in Odisha. You can reply STOP at any time to stop messages.`,
    q: {
      use: 'What will you use the space for? For example office, shop, showroom, restaurant, clinic, coaching or warehouse.',
      size: 'Roughly how much space do you need, in sq ft? A range is fine.',
      budget: 'What is your monthly budget, including maintenance? Per sq ft or a monthly total, either is fine.',
      location: 'Which area or landmark should it be near?',
      moveIn: 'When do you want to move in?',
      furnishing: 'Do you need it ready to use (plug-and-play), or will you do your own interiors?',
      parking4w: 'How many car parks do you need? Say 0 if none.',
    },
    qs: {
      use: 'Sorry, I missed that. Is it for an office, shop, showroom, restaurant, clinic or warehouse?',
      size: 'Sorry, I missed that. How many sq ft, roughly? For example 1,500 sq ft.',
      budget: 'Sorry, I missed that. What can you pay each month for rent plus maintenance? For example ₹60 per sq ft.',
      location: 'Sorry, I missed that. Which area in Bhubaneswar, Cuttack or Puri?',
      moveIn: 'Sorry, I missed that. When do you want to start? For example "in 1 month".',
      furnishing: 'Sorry, I missed that. Ready to use, or empty space for your own interiors?',
      parking4w: 'Sorry, I missed that. How many car parks? Type a number, or 0 for none.',
    },
    ack: (v) => `Got it: ${v}.`,
    shortIntro: (n) => `Here ${n === 1 ? 'is 1 space that fits' : 'are ' + n + ' spaces that fit'} what you told me:`,
    pickPrompt: (n) => `Reply ${numList(n, 'en')} to see visit times, or ask me anything about ${n === 1 ? 'it' : 'them'}.`,
    pickAgain: (n) => `Sorry, I didn't catch which one. Reply ${numList(n, 'en')}.`,
    slotOffer: (u) => `Here are the visit times for ${u}. Pick one:`,
    slotAgain: 'Sorry, I didn\'t catch the time. Please tap one of these:',
    booked: (u, w, h8) => `Booked: ${u}, ${w}.` + (h8 ? ' A colleague will call you the day before to confirm.' : ''),
    sysH8: 'Rule H8: a person will call the day before to confirm.',
    thanks: 'You\'re welcome. See you at the visit.',
    ho: {
      generic: (f, s, g) => `I've asked ${f} from our team to call you. ${g === 'f' ? 'She' : 'He'}'ll reach you within ${s} minutes.`,
      H1: (f, s, g) => `Rent is agreed with the owner, so I'll leave that to ${f}. ${g === 'f' ? 'She' : 'He'}'ll call you within ${s} minutes to talk about the price.`,
      H2: (f, s) => `Agreement terms need a person to answer properly. I've asked ${f} to call you within ${s} minutes.`,
      H3: (f, s) => `I'm sorry about this. I've asked ${f}, our senior manager, to call you personally within ${s} minutes.`,
      H4: (f, s, g) => `Of course. I've asked ${f} from our team to call you. ${g === 'f' ? 'She' : 'He'}'ll reach you within ${s} minutes.`,
      H5: (f, s) => `Thank you, that is a large requirement. Our senior manager ${f} will take it from here and call you within ${s} minutes.`,
      H6: (f, s) => `I don't have a space that fits all of this right now. I've asked ${f} to look for off-market and upcoming options and call you within ${s} minutes.`,
      H7: (f, s, g) => `Sorry, I'm having trouble understanding. I've asked ${f} from our team to call you. ${g === 'f' ? 'She' : 'He'}'ll reach you within ${s} minutes.`,
      H9: (f, s, g) => `Welcome back. I can see you're already in touch with ${f}. I've let ${g === 'f' ? 'her' : 'him'} know, and ${g === 'f' ? 'she' : 'he'}'ll call you within ${s} minutes.`,
    },
    held: (f) => `Noted. ${f} will see this when they call you.`,
    off: {
      H1: 'I can\'t change the rent myself. The rent on each listing is what the owner has asked for. I\'ve noted your request for the visit.',
      H2: 'I can\'t advise on legal terms. A sample agreement can be shared at the visit.',
      H3: 'I\'m sorry about that. I\'ve noted it and our team will look into it.',
      H4: 'I\'m an automated assistant, but I can help with options and visits right here on WhatsApp.',
      H6: 'I don\'t have a space that fits all of this right now. I\'ll keep your requirement on file and message you when something comes up.',
      H7: 'No problem, we\'ll skip that for now.',
    },
    nudge1: (n) => `Hi${n ? ' ' + n : ''}, just checking in. Are you still looking for space? Reply here and I'll pick up where we stopped.`,
    nudge2: 'Last message from me for now. If your plan has changed, no problem. If not, reply with any answer and I\'ll continue, or I can ask a colleague to call you.',
    nurture: (d) => `Thanks. Since you plan to move in around ${d}, I'll message you again closer to the time with fresh options. Reply any time if your plan changes.`,
    closing: 'Thanks for letting me know, and good luck with the new place. If you need space again, message us any time.',
    stop: 'You\'re unsubscribed. We won\'t message you again. Reply START if you change your mind.',
    back: 'I\'m back on this chat to help with the next step.',
    welcomeBack: 'Welcome back. Let\'s carry on.',
    noneOfThese: 'Understood, none of these suit you. I\'ll ask a colleague to look for more options.',
    faq: {
      gst: '18% GST applies on rent and maintenance.',
      deposit: (u) => `For ${u.unit_id}, the security deposit is ${u.deposit_months} months of rent, ${LC.fmtINR(u.deposit_amount)}.`,
      lockin: (u) => `${u.unit_id} has a lock-in of ${u.lock_in_months} months and a lease term of ${u.lease_term_years} years.`,
      maint: (u) => `Maintenance at ${u.unit_id} is ₹${u.cam_per_sqft}/sq ft a month. It is already inside the all-in figure I showed.`,
      parking: (u) => `${u.unit_id} has ${u.parking_4w || 0} car parks and ${u.parking_2w || 0} two-wheeler parks.`,
      photos: (u) => `Here is ${u.unit_id}. There are ${u.photos || 1} photos in all. A colleague can send the rest.`,
      location: (u, link) => `Here is the location of ${u.unit_id}: ${link}`,
      generic: 'I\'ll share that with each option, once I know what you need.',
      unknown: 'Good question. I don\'t want to guess, so I\'ll note it for your visit.',
    },
    pickedUp: (a) => `Hi, this is ${a} from Leasify Commercial. I'm calling you now.`,
    okThanks: 'Okay, thank you.',
  },
  hi: {
    greet: (n) => `नमस्ते${n ? ' ' + n : ''}! यह Leasify Commercial डेस्क है। हम ओडिशा में ऑफिस, दुकान और गोदाम ढूँढने में कारोबारियों की मदद करते हैं। मैसेज बंद करने के लिए कभी भी STOP लिखें।`,
    q: {
      use: 'आप जगह किस काम के लिए चाहते हैं? जैसे ऑफिस, दुकान, शोरूम, रेस्टोरेंट, क्लिनिक, कोचिंग या गोदाम।',
      size: 'आपको लगभग कितनी जगह चाहिए, sq ft में? रेंज बता सकते हैं।',
      budget: 'मेंटेनेंस सहित आपका मासिक बजट कितना है? प्रति sq ft या कुल महीने का, जो आसान हो।',
      location: 'किस इलाके या लैंडमार्क के पास चाहिए?',
      moveIn: 'आप कब शिफ्ट होना चाहते हैं?',
      furnishing: 'क्या जगह तैयार (plug-and-play) चाहिए, या आप खुद इंटीरियर करेंगे?',
      parking4w: 'कितनी कार पार्किंग चाहिए? ज़रूरत न हो तो 0 लिखें।',
    },
    qs: {
      use: 'माफ़ कीजिए, समझ नहीं आया। ऑफिस, दुकान, शोरूम, रेस्टोरेंट, क्लिनिक या गोदाम, इनमें से क्या?',
      size: 'माफ़ कीजिए, समझ नहीं आया। लगभग कितने sq ft? जैसे 1,500 sq ft।',
      budget: 'माफ़ कीजिए, समझ नहीं आया। किराया और मेंटेनेंस मिलाकर महीने में कितना दे सकते हैं? जैसे ₹60 per sq ft।',
      location: 'माफ़ कीजिए, समझ नहीं आया। भुवनेश्वर, कटक या पुरी में कौन सा इलाका?',
      moveIn: 'माफ़ कीजिए, समझ नहीं आया। कब से शुरू करना है? जैसे "in 1 month"।',
      furnishing: 'माफ़ कीजिए, समझ नहीं आया। तैयार जगह चाहिए, या खाली जगह जिसमें आप खुद इंटीरियर करें?',
      parking4w: 'माफ़ कीजिए, समझ नहीं आया। कितनी कार पार्किंग? एक नंबर लिखें, या 0।',
    },
    ack: (v) => `ठीक है: ${v}।`,
    shortIntro: (n) => `आपकी ज़रूरत के हिसाब से ये ${n} जगहें ठीक रहेंगी:`,
    pickPrompt: (n) => `विज़िट का समय देखने के लिए ${numList(n, 'hi')} लिखें, या इनके बारे में कुछ भी पूछें।`,
    pickAgain: (n) => `माफ़ कीजिए, कौन सा, यह समझ नहीं आया। ${numList(n, 'hi')} लिखें।`,
    slotOffer: (u) => `${u} के लिए विज़िट के समय ये हैं। एक चुनें:`,
    slotAgain: 'माफ़ कीजिए, समय समझ नहीं आया। कृपया इनमें से एक दबाएँ:',
    booked: (u, w, h8) => `बुक हो गया: ${u}, ${w}।` + (h8 ? ' हमारे एक साथी एक दिन पहले कॉल करके पक्का करेंगे।' : ''),
    sysH8: 'Rule H8: a person will call the day before to confirm.',
    thanks: 'धन्यवाद। विज़िट पर मिलते हैं।',
    ho: {
      generic: (f, s) => `मैंने हमारी टीम के ${f} से आपको कॉल करने के लिए कहा है। वे ${s} मिनट के अंदर आपसे बात करेंगे।`,
      H1: (f, s) => `किराया मालिक के साथ तय होता है, इसलिए यह ${f} देखेंगे। वे ${s} मिनट में कॉल करके कीमत पर बात करेंगे।`,
      H2: (f, s) => `एग्रीमेंट की शर्तों पर सही जवाब कोई व्यक्ति ही दे सकता है। मैंने ${f} से ${s} मिनट में कॉल करने को कहा है।`,
      H3: (f, s) => `असुविधा के लिए खेद है। मैंने हमारे सीनियर मैनेजर ${f} से कहा है कि वे खुद ${s} मिनट में आपको कॉल करें।`,
      H4: (f, s) => `ज़रूर। मैंने हमारी टीम के ${f} से कहा है कि वे आपको कॉल करें। वे ${s} मिनट में बात करेंगे।`,
      H5: (f, s) => `धन्यवाद, यह बड़ी ज़रूरत है। हमारे सीनियर मैनेजर ${f} इसे आगे संभालेंगे और ${s} मिनट में आपको कॉल करेंगे।`,
      H6: (f, s) => `अभी आपकी सभी ज़रूरतों पर खरी उतरने वाली जगह मेरे पास नहीं है। मैंने ${f} से कहा है कि वे और विकल्प ढूँढकर ${s} मिनट में आपको कॉल करें।`,
      H7: (f, s) => `माफ़ कीजिए, मुझे समझने में दिक्कत हो रही है। मैंने ${f} से कहा है कि वे आपको कॉल करें। वे ${s} मिनट में बात करेंगे।`,
      H9: (f, s) => `फिर से स्वागत है। मुझे दिख रहा है कि आप पहले से ${f} के संपर्क में हैं। मैंने उन्हें बता दिया है, वे ${s} मिनट में आपको कॉल करेंगे।`,
    },
    held: (f) => `ठीक है, नोट कर लिया। ${f} कॉल करते समय इसे देख लेंगे।`,
    off: {
      H1: 'मैं खुद किराया नहीं बदल सकता। हर लिस्टिंग का किराया वही है जो मालिक ने माँगा है। आपकी बात मैंने विज़िट के लिए नोट कर ली है।',
      H2: 'कानूनी शर्तों पर मैं सलाह नहीं दे सकता। विज़िट पर सैंपल एग्रीमेंट दिखाया जा सकता है।',
      H3: 'इसके लिए खेद है। मैंने इसे नोट कर लिया है, हमारी टीम देखेगी।',
      H4: 'मैं एक ऑटोमेटेड असिस्टेंट हूँ, लेकिन विकल्प और विज़िट में यहीं WhatsApp पर मदद कर सकता हूँ।',
      H6: 'अभी आपकी सभी ज़रूरतों पर खरी उतरने वाली जगह नहीं है। आपकी ज़रूरत हमारे पास दर्ज रहेगी, कुछ आने पर हम मैसेज करेंगे।',
      H7: 'कोई बात नहीं, इसे अभी छोड़ देते हैं।',
    },
    nudge1: (n) => `नमस्ते${n ? ' ' + n : ''}, बस हाल पूछने के लिए मैसेज किया है। क्या आप अब भी जगह ढूँढ रहे हैं? यहीं जवाब दें, हम वहीं से आगे बढ़ेंगे जहाँ रुके थे।`,
    nudge2: 'फ़िलहाल यह हमारी तरफ़ से आखिरी मैसेज है। अगर आपका प्लान बदल गया है तो कोई बात नहीं। नहीं तो कोई भी जवाब दें, हम आगे बढ़ेंगे, या हमारे साथी आपको कॉल कर सकते हैं।',
    nurture: (d) => `धन्यवाद। आप ${d} के आसपास आना चाहते हैं, इसलिए तारीख़ पास आने पर हम नए विकल्पों के साथ मैसेज करेंगे। प्लान बदले तो कभी भी जवाब दें।`,
    closing: 'बताने के लिए धन्यवाद, नई जगह के लिए शुभकामनाएँ। फिर कभी जगह चाहिए तो हमें मैसेज करें।',
    stop: 'आपको अनसब्सक्राइब कर दिया गया है। हम दोबारा मैसेज नहीं करेंगे। मन बदले तो START लिखें।',
    back: 'अगले कदम में मदद के लिए मैं इस चैट में वापस आ गया हूँ।',
    welcomeBack: 'फिर से स्वागत है। चलिए आगे बढ़ते हैं।',
    noneOfThese: 'समझ गया, इनमें से कोई ठीक नहीं है। मैं अपने साथी से और विकल्प ढूँढने को कहता हूँ।',
    faq: {
      gst: 'किराए और मेंटेनेंस पर 18% GST लगता है।',
      deposit: (u) => `${u.unit_id} के लिए सिक्योरिटी डिपॉजिट ${u.deposit_months} महीने का किराया है, यानी ${LC.fmtINR(u.deposit_amount)}।`,
      lockin: (u) => `${u.unit_id} में ${u.lock_in_months} महीने का लॉक-इन है और लीज़ ${u.lease_term_years} साल की है।`,
      maint: (u) => `${u.unit_id} में मेंटेनेंस ₹${u.cam_per_sqft}/sq ft प्रति माह है। यह मेरे बताए ऑल-इन आँकड़े में पहले से शामिल है।`,
      parking: (u) => `${u.unit_id} में ${u.parking_4w || 0} कार पार्किंग और ${u.parking_2w || 0} दोपहिया पार्किंग है।`,
      photos: (u) => `यह ${u.unit_id} है। कुल ${u.photos || 1} फोटो हैं। बाकी हमारे साथी भेज देंगे।`,
      location: (u, link) => `${u.unit_id} की लोकेशन यह है: ${link}`,
      generic: 'आपकी ज़रूरत समझने के बाद, यह मैं हर विकल्प के साथ बता दूँगा।',
      unknown: 'अच्छा सवाल है। मैं अंदाज़ा नहीं लगाना चाहता, इसलिए इसे आपकी विज़िट के लिए नोट कर लेता हूँ।',
    },
    pickedUp: (a) => `नमस्ते, Leasify Commercial से ${a} बोल रहे हैं। हम अभी आपको कॉल कर रहे हैं।`,
    okThanks: 'ठीक है, धन्यवाद।',
  },
  od: {
    greet: (n) => `ନମସ୍କାର${n ? ' ' + n : ''}! ଏହା Leasify Commercial ଡେସ୍କ। ଓଡ଼ିଶାରେ ଅଫିସ, ଦୋକାନ ଓ ଗୋଦାମ ଖୋଜିବାରେ ଆମେ ବ୍ୟବସାୟୀମାନଙ୍କୁ ସାହାଯ୍ୟ କରୁ। ମେସେଜ୍ ବନ୍ଦ କରିବାକୁ ଯେକୌଣସି ସମୟରେ STOP ଲେଖନ୍ତୁ।`,
    q: {
      use: 'ଆପଣ ଜାଗାଟି କେଉଁ କାମ ପାଇଁ ଚାହୁଁଛନ୍ତି? ଯେମିତି ଅଫିସ, ଦୋକାନ, ସୋରୁମ, ରେଷ୍ଟୁରାଣ୍ଟ, କ୍ଲିନିକ, କୋଚିଂ କିମ୍ବା ଗୋଦାମ।',
      size: 'ଆପଣଙ୍କୁ ପ୍ରାୟ କେତେ ଜାଗା ଦରକାର, sq ft ରେ? ଏକ ପରିସର କହିଲେ ଚଳିବ।',
      budget: 'ମେଣ୍ଟେନାନ୍ସ ସହ ଆପଣଙ୍କ ମାସିକ ବଜେଟ୍ କେତେ? ପ୍ରତି sq ft କିମ୍ବା ମୋଟ ମାସିକ, ଯାହା ସହଜ।',
      location: 'କେଉଁ ଅଞ୍ଚଳ କିମ୍ବା ଲ୍ୟାଣ୍ଡମାର୍କ ନିକଟରେ ଦରକାର?',
      moveIn: 'ଆପଣ କେବେ ଆରମ୍ଭ କରିବାକୁ ଚାହୁଁଛନ୍ତି?',
      furnishing: 'ଜାଗା ବ୍ୟବହାର ପାଇଁ ପ୍ରସ୍ତୁତ (plug-and-play) ଦରକାର, ନା ଆପଣ ନିଜେ ଇଣ୍ଟେରିଅର କରିବେ?',
      parking4w: 'କେତୋଟି କାର ପାର୍କିଂ ଦରକାର? ଦରକାର ନଥିଲେ 0 ଲେଖନ୍ତୁ।',
    },
    qs: {
      use: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। ଅଫିସ, ଦୋକାନ, ସୋରୁମ, ରେଷ୍ଟୁରାଣ୍ଟ, କ୍ଲିନିକ କିମ୍ବା ଗୋଦାମ, କେଉଁଟି?',
      size: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। ପ୍ରାୟ କେତେ sq ft? ଯେମିତି 1,500 sq ft।',
      budget: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। ଭଡା ଓ ମେଣ୍ଟେନାନ୍ସ ମିଶାଇ ମାସକୁ କେତେ ଦେଇପାରିବେ? ଯେମିତି ₹60 per sq ft।',
      location: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। ଭୁବନେଶ୍ୱର, କଟକ କିମ୍ବା ପୁରୀର କେଉଁ ଅଞ୍ଚଳ?',
      moveIn: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। କେବେ ଆରମ୍ଭ କରିବେ? ଯେମିତି "in 1 month"।',
      furnishing: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। ପ୍ରସ୍ତୁତ ଜାଗା ଦରକାର, ନା ଖାଲି ଜାଗା ଯେଉଁଥିରେ ଆପଣ ନିଜେ ଇଣ୍ଟେରିଅର କରିବେ?',
      parking4w: 'ଦୁଃଖିତ, ବୁଝିପାରିଲି ନାହିଁ। କେତୋଟି କାର ପାର୍କିଂ? ଗୋଟିଏ ସଂଖ୍ୟା ଲେଖନ୍ତୁ, କିମ୍ବା 0।',
    },
    ack: (v) => `ବୁଝିଲି: ${v}।`,
    shortIntro: (n) => `ଆପଣଙ୍କ ଆବଶ୍ୟକତା ଅନୁସାରେ ଏହି ${n}ଟି ଜାଗା ଠିକ୍ ହେବ:`,
    pickPrompt: (n) => `ଭିଜିଟ୍ ସମୟ ଦେଖିବାକୁ ${numList(n, 'od')} ଲେଖନ୍ତୁ, କିମ୍ବା ଏହା ବିଷୟରେ ଯେକୌଣସି ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ।`,
    pickAgain: (n) => `ଦୁଃଖିତ, କେଉଁଟି ବୁଝିପାରିଲି ନାହିଁ। ${numList(n, 'od')} ଲେଖନ୍ତୁ।`,
    slotOffer: (u) => `${u} ପାଇଁ ଭିଜିଟ୍ ସମୟ ଏହି। ଗୋଟିଏ ବାଛନ୍ତୁ:`,
    slotAgain: 'ଦୁଃଖିତ, ସମୟ ବୁଝିପାରିଲି ନାହିଁ। ଦୟାକରି ଏଗୁଡ଼ିକ ମଧ୍ୟରୁ ଗୋଟିଏ ଦବାନ୍ତୁ:',
    booked: (u, w, h8) => `ବୁକ୍ ହୋଇଗଲା: ${u}, ${w}।` + (h8 ? ' ଜଣେ ସହକର୍ମୀ ଆଗ ଦିନ କଲ କରି ନିଶ୍ଚିତ କରିବେ।' : ''),
    sysH8: 'Rule H8: a person will call the day before to confirm.',
    thanks: 'ଧନ୍ୟବାଦ। ଭିଜିଟ୍ ରେ ଦେଖା ହେବା।',
    ho: {
      generic: (f, s) => `ଆମ ଟିମ୍ ର ${f} ଆପଣଙ୍କୁ ${s} ମିନିଟ୍ ଭିତରେ କଲ କରିବେ। ମୁଁ ସେମାନଙ୍କୁ ଜଣାଇ ଦେଇଛି।`,
      H1: (f, s) => `ଭଡା ମାଲିକଙ୍କ ସହ ସ୍ଥିର ହୁଏ, ତେଣୁ ଏହା ଆମ ଟିମ୍ ର ${f} ଦେଖିବେ। ସେ ${s} ମିନିଟ୍ ଭିତରେ କଲ କରି ମୂଲ୍ୟ ବିଷୟରେ କଥା ହେବେ।`,
      H2: (f, s) => `ଚୁକ୍ତିନାମାର ସର୍ତ୍ତ ବିଷୟରେ ସଠିକ୍ ଉତ୍ତର ଜଣେ ବ୍ୟକ୍ତି ଦେଇପାରିବେ। ଆମ ଟିମ୍ ର ${f} ${s} ମିନିଟ୍ ଭିତରେ ଆପଣଙ୍କୁ କଲ କରିବେ।`,
      H3: (f, s) => `ଅସୁବିଧା ପାଇଁ ଦୁଃଖିତ। ଆମର ସିନିୟର ମ୍ୟାନେଜର ${f} ନିଜେ ${s} ମିନିଟ୍ ଭିତରେ ଆପଣଙ୍କୁ କଲ କରିବେ।`,
      H4: (f, s) => `ନିଶ୍ଚୟ। ଆମ ଟିମ୍ ର ${f} ଆପଣଙ୍କୁ ${s} ମିନିଟ୍ ଭିତରେ କଲ କରିବେ।`,
      H5: (f, s) => `ଧନ୍ୟବାଦ, ଏହା ଏକ ବଡ଼ ଆବଶ୍ୟକତା। ଆମର ସିନିୟର ମ୍ୟାନେଜର ${f} ଏହାକୁ ଆଗକୁ ନେବେ ଏବଂ ${s} ମିନିଟ୍ ଭିତରେ ଆପଣଙ୍କୁ କଲ କରିବେ।`,
      H6: (f, s) => `ଏବେ ଆପଣଙ୍କ ସବୁ ଆବଶ୍ୟକତାକୁ ମିଳୁଥିବା ଜାଗା ମୋ ପାଖରେ ନାହିଁ। ଆମ ଟିମ୍ ର ${f} ଅନ୍ୟ ବିକଳ୍ପ ଖୋଜି ${s} ମିନିଟ୍ ଭିତରେ ଆପଣଙ୍କୁ କଲ କରିବେ।`,
      H7: (f, s) => `ଦୁଃଖିତ, ମୁଁ ବୁଝିପାରୁନାହିଁ। ଆମ ଟିମ୍ ର ${f} ଆପଣଙ୍କୁ ${s} ମିନିଟ୍ ଭିତରେ କଲ କରିବେ।`,
      H9: (f, s) => `ପୁଣି ସ୍ୱାଗତ। ଆପଣ ଆଗରୁ ଆମ ଟିମ୍ ସହ ଯୋଗାଯୋଗରେ ଅଛନ୍ତି। ${f} ${s} ମିନିଟ୍ ଭିତରେ ଆପଣଙ୍କୁ କଲ କରିବେ।`,
    },
    held: (f) => `ଠିକ୍ ଅଛି, ନୋଟ୍ କରିଛି। ${f} କଲ କରିବା ବେଳେ ଏହା ଦେଖିବେ।`,
    off: {
      H1: 'ମୁଁ ନିଜେ ଭଡା ବଦଳାଇପାରିବି ନାହିଁ। ପ୍ରତ୍ୟେକ ଲିଷ୍ଟିଂର ଭଡା ମାଲିକ ଚାହିଥିବା ଭଡା। ଆପଣଙ୍କ କଥା ଭିଜିଟ୍ ପାଇଁ ନୋଟ୍ କରିଛି।',
      H2: 'ଆଇନଗତ ସର୍ତ୍ତ ବିଷୟରେ ମୁଁ ପରାମର୍ଶ ଦେଇପାରିବି ନାହିଁ। ଭିଜିଟ୍ ବେଳେ ନମୂନା ଚୁକ୍ତିନାମା ଦେଖାଯାଇପାରିବ।',
      H3: 'ଏଥିପାଇଁ ଦୁଃଖିତ। ମୁଁ ଏହାକୁ ନୋଟ୍ କରିଛି, ଆମ ଟିମ୍ ଦେଖିବେ।',
      H4: 'ମୁଁ ଗୋଟିଏ ସ୍ୱୟଂଚାଳିତ ସହାୟକ, କିନ୍ତୁ ବିକଳ୍ପ ଓ ଭିଜିଟ୍ ରେ ଏଠାରେ WhatsApp ରେ ସାହାଯ୍ୟ କରିପାରିବି।',
      H6: 'ଏବେ ଆପଣଙ୍କ ସବୁ ଆବଶ୍ୟକତାକୁ ମିଳୁଥିବା ଜାଗା ନାହିଁ। ଆପଣଙ୍କ ଆବଶ୍ୟକତା ଆମ ପାଖରେ ରହିବ, କିଛି ଆସିଲେ ଆମେ ମେସେଜ୍ କରିବୁ।',
      H7: 'କିଛି ଅସୁବିଧା ନାହିଁ, ଏହାକୁ ଏବେ ଛାଡ଼ିଦେଉଛୁ।',
    },
    nudge1: (n) => `ନମସ୍କାର${n ? ' ' + n : ''}, କେବଳ ପଚାରୁଥିଲି। ଆପଣ ଏବେ ବି ଜାଗା ଖୋଜୁଛନ୍ତି କି? ଏଠାରେ ଉତ୍ତର ଦିଅନ୍ତୁ, ଆମେ ଯେଉଁଠି ଛାଡ଼ିଥିଲୁ ସେଠାରୁ ଆରମ୍ଭ କରିବା।`,
    nudge2: 'ଏବେ ପାଇଁ ଏହା ଆମର ଶେଷ ମେସେଜ୍। ଆପଣଙ୍କ ଯୋଜନା ବଦଳିଥିଲେ ଠିକ୍ ଅଛି। ନହେଲେ ଯେକୌଣସି ଉତ୍ତର ଦିଅନ୍ତୁ, ଆମେ ଆଗକୁ ବଢ଼ିବୁ, କିମ୍ବା ଆମ ସହକର୍ମୀ ଆପଣଙ୍କୁ କଲ କରିପାରିବେ।',
    nurture: (d) => `ଧନ୍ୟବାଦ। ଆପଣ ${d} ବେଳକୁ ଆରମ୍ଭ କରିବାକୁ ଚାହୁଁଥିବାରୁ, ସମୟ ପାଖେଇ ଆସିଲେ ଆମେ ନୂଆ ବିକଳ୍ପ ସହ ମେସେଜ୍ କରିବୁ। ଯୋଜନା ବଦଳିଲେ ଯେକୌଣସି ସମୟରେ ଉତ୍ତର ଦିଅନ୍ତୁ।`,
    closing: 'ଜଣାଇଥିବାରୁ ଧନ୍ୟବାଦ, ନୂଆ ଜାଗା ପାଇଁ ଶୁଭକାମନା। ପୁଣି ଜାଗା ଦରକାର ହେଲେ ଯେକୌଣସି ସମୟରେ ମେସେଜ୍ କରନ୍ତୁ।',
    stop: 'ଆପଣଙ୍କୁ ଅନସବସ୍କ୍ରାଇବ୍ କରାଗଲା। ଆମେ ଆଉ ମେସେଜ୍ କରିବୁ ନାହିଁ। ମନ ବଦଳିଲେ START ଲେଖନ୍ତୁ।',
    back: 'ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପରେ ସାହାଯ୍ୟ ପାଇଁ ମୁଁ ଏହି ଚାଟ୍ ରେ ଫେରିଆସିଛି।',
    welcomeBack: 'ପୁଣି ସ୍ୱାଗତ। ଆସନ୍ତୁ ଆଗକୁ ବଢ଼ିବା।',
    noneOfThese: 'ବୁଝିଲି, ଏଥିରୁ କୌଣସିଟି ଠିକ୍ ନୁହେଁ। ମୁଁ ଆମ ସହକର୍ମୀଙ୍କୁ ଆହୁରି ବିକଳ୍ପ ଖୋଜିବାକୁ କହୁଛି।',
    faq: {
      gst: 'ଭଡା ଓ ମେଣ୍ଟେନାନ୍ସ ଉପରେ 18% GST ଲାଗେ।',
      deposit: (u) => `${u.unit_id} ପାଇଁ ସିକ୍ୟୁରିଟି ଡିପୋଜିଟ୍ ${u.deposit_months} ମାସର ଭଡା, ଅର୍ଥାତ୍ ${LC.fmtINR(u.deposit_amount)}।`,
      lockin: (u) => `${u.unit_id} ରେ ${u.lock_in_months} ମାସର ଲକ୍-ଇନ୍ ଓ ${u.lease_term_years} ବର୍ଷର ଲିଜ୍ ଅଛି।`,
      maint: (u) => `${u.unit_id} ରେ ମେଣ୍ଟେନାନ୍ସ ପ୍ରତି ମାସ ₹${u.cam_per_sqft}/sq ft। ମୁଁ ଦେଖାଇଥିବା ସର୍ବମୋଟ ଅଙ୍କରେ ଏହା ଆଗରୁ ମିଶିଛି।`,
      parking: (u) => `${u.unit_id} ରେ ${u.parking_4w || 0}ଟି କାର ଓ ${u.parking_2w || 0}ଟି ଦୁଇଚକିଆ ପାର୍କିଂ ଅଛି।`,
      photos: (u) => `ଏହା ${u.unit_id}। ମୋଟ ${u.photos || 1}ଟି ଫଟୋ ଅଛି। ବାକି ଆମ ସହକର୍ମୀ ପଠାଇବେ।`,
      location: (u, link) => `${u.unit_id} ର ଲୋକେସନ୍ ଏହା: ${link}`,
      generic: 'ଆପଣଙ୍କ ଆବଶ୍ୟକତା ଜାଣିବା ପରେ, ମୁଁ ଏହା ପ୍ରତ୍ୟେକ ବିକଳ୍ପ ସହ ଜଣାଇବି।',
      unknown: 'ଭଲ ପ୍ରଶ୍ନ। ମୁଁ ଅନୁମାନ କରିବାକୁ ଚାହେଁ ନାହିଁ, ତେଣୁ ଆପଣଙ୍କ ଭିଜିଟ୍ ପାଇଁ ଏହାକୁ ନୋଟ୍ କରୁଛି।',
    },
    pickedUp: (a) => `ନମସ୍କାର, ମୁଁ Leasify Commercial ରୁ ${a}। ମୁଁ ଏବେ ଆପଣଙ୍କୁ କଲ କରୁଛି।`,
    okThanks: 'ଠିକ୍ ଅଛି, ଧନ୍ୟବାଦ।',
  },
};
const QUICK = {   // quick-reply options used when a question has to be asked again (max 3, like WhatsApp reply buttons)
  use: ['Office', 'Shop', 'Warehouse'],
  size: ['1,000-2,500 sq ft', '2,500-5,000 sq ft', '5,000+ sq ft'],
  budget: ['₹40 per sq ft', '₹60 per sq ft', '₹80 per sq ft'],
  location: ['Patia', 'Cuttack', 'Puri'],
  moveIn: ['Immediately', 'In 1 month', 'In 3 months'],
  furnishing: ['Plug-and-play', 'Warm shell', 'Bare shell (own interiors)'],
  parking4w: ['No parking', '1 car park', '2 car parks'],
};

/* ---------------- simulated occupiers (personas) ---------------- */
const P_FIRST = ['Amit', 'Sourav', 'Priya', 'Rakesh', 'Sneha', 'Bibhuti', 'Ipsita', 'Manas', 'Pooja', 'Sujit', 'Ritika', 'Deepak', 'Smita', 'Ashish', 'Lopamudra', 'Nihar', 'Anjali', 'Prakash', 'Swati', 'Biswajit', 'Tapas', 'Madhusmita', 'Rahul', 'Sasmita', 'Kunal', 'Itishree', 'Saroj', 'Neha', 'Bijay', 'Sonali', 'Debasis', 'Chinmayee'];
const P_LAST = ['Mohapatra', 'Sahoo', 'Das', 'Mishra', 'Panda', 'Behera', 'Nayak', 'Rath', 'Jena', 'Pradhan', 'Swain', 'Rout', 'Patnaik', 'Acharya', 'Dash', 'Agarwal', 'Sethi', 'Barik', 'Samal', 'Parida'];
const P_COMP = {
  Office: ['Finlogic IT Services', 'Zenith Support Solutions', 'Infinity Software Labs', 'Northstar Consulting', 'Kalinga Pharma Distributors', 'Coastline Shipping Agency', 'Deltaware Analytics', 'Utkal Insurance Advisors', 'Pixel Forge Studios', 'Mahanadi Tech Works', 'Bluewave Accounting'],
  Coworking: ['Launchpad Startups', 'Codecraft Labs', 'Bluefin Digital'],
  Retail: ['Wellness Pharmacy', 'MobileHub', 'Sunshine Opticals', 'QuickMart Grocery', 'Utkal Handloom House', 'Silver Thread Boutique', 'Glow Salon', 'Coastline Souvenirs'],
  Showroom: ['Trident Motors', 'HomeNest Furniture', 'VoltRide E-bikes', 'Brightline Electronics', 'Granite and Co Tiles'],
  'F&B': ['Brew Street Cafe', 'Saffron Restaurant', 'Tasty Tiffin Kitchen', 'Sea Breeze Cafe', 'Dosa Corner'],
  Clinic: ['CarePlus Diagnostics', 'Nova Dental Clinic', 'Lotus Eye Care', 'Healwell Physiotherapy'],
  Institutional: ['Bright Minds Coaching', 'Vidya Tutorials', 'SkillUp Training Academy'],
  Warehouse: ['Swift Logistics', 'Odisha Agro Traders', 'Rapid Courier', 'Greenleaf Organics', 'Coastal Seafood Exports', 'Eastern FMCG Distributors'],
  Industrial: ['Precision Fabricators', 'Kalinga Packaging Works'],
};
const USE_EN = { Office: 'office', Coworking: 'coworking space', Retail: 'retail shop', Showroom: 'showroom', 'F&B': 'restaurant', Clinic: 'clinic', Institutional: 'coaching centre', Warehouse: 'warehouse', Industrial: 'workshop' };
const USE_SENT = {
  en: {
    Office: ['It\'s for an office.', 'Office space for my team.', 'We need it as an office.'],
    Coworking: ['A coworking space for our team.', 'We need a coworking space.'],
    Retail: ['It\'s for a shop.', 'A retail shop.'],
    Showroom: ['A showroom, please.', 'It\'s for a showroom.'],
    'F&B': ['A restaurant.', 'It\'s for a cafe.'],
    Clinic: ['It\'s for a clinic.', 'A clinic.'],
    Institutional: ['A coaching centre.', 'It\'s for coaching classes.'],
    Warehouse: ['A warehouse for storage.', 'We need a warehouse.'],
    Industrial: ['A workshop for our production work.', 'It\'s for a workshop.'],
  },
  hi: {
    Office: ['ऑफिस के लिए चाहिए।', 'Office space चाहिए।'], Coworking: ['coworking space चाहिए।'], Retail: ['दुकान के लिए।', 'एक shop चाहिए।'], Showroom: ['शोरूम के लिए।'], 'F&B': ['रेस्टोरेंट के लिए।'],
    Clinic: ['क्लिनिक के लिए।'], Institutional: ['कोचिंग सेंटर के लिए।'], Warehouse: ['गोदाम चाहिए।'], Industrial: ['workshop के लिए।'],
  },
  od: {
    Office: ['ଅଫିସ ପାଇଁ ଦରକାର।'], Coworking: ['coworking space ଦରକାର।'], Retail: ['ଦୋକାନ ପାଇଁ।'], Showroom: ['ସୋରୁମ ପାଇଁ।'], 'F&B': ['ରେଷ୍ଟୁରାଣ୍ଟ ପାଇଁ।'],
    Clinic: ['କ୍ଲିନିକ ପାଇଁ।'], Institutional: ['କୋଚିଂ ସେଣ୍ଟର ପାଇଁ।'], Warehouse: ['ଗୋଦାମ ପାଇଁ ଦରକାର।'], Industrial: ['workshop ପାଇଁ।'],
  },
};
const USE_SHORT = { hi: { Office: 'ऑफिस', Coworking: 'coworking space', Retail: 'दुकान', Showroom: 'शोरूम', 'F&B': 'रेस्टोरेंट', Clinic: 'क्लिनिक', Institutional: 'कोचिंग सेंटर', Warehouse: 'गोदाम', Industrial: 'workshop' }, od: { Office: 'ଅଫିସ', Coworking: 'coworking space', Retail: 'ଦୋକାନ', Showroom: 'ସୋରୁମ', 'F&B': 'ରେଷ୍ଟୁରାଣ୍ଟ', Clinic: 'କ୍ଲିନିକ', Institutional: 'କୋଚିଂ ସେଣ୍ଟର', Warehouse: 'ଗୋଦାମ', Industrial: 'workshop' } };
const EN_BASE = {
  Office: 'looking for an office space on rent', Coworking: 'looking for a coworking space', Retail: 'looking for a shop on rent', Showroom: 'looking for a showroom space', 'F&B': 'looking for a restaurant space',
  Clinic: 'looking for a space for my clinic', Institutional: 'looking for a space for a coaching centre', Warehouse: 'looking for a warehouse on rent', Industrial: 'looking for a workshop space',
};
const PL = {   // lines a simulated occupier says, per language
  en: {
    negotiate: ['Can the owner reduce the rent a little?', 'Is there any room to reduce the rent?'],
    legal: ['Who pays stamp duty and registration?', 'Who pays the stamp duty and registration for the agreement?'],
    upset: ['This is the worst service. Nobody has called me back.', 'Very pathetic service, I am angry.'],
    human: ['Please call me.', 'Can you call me? I prefer to talk.'],
    lost: ['Thanks, but we already found another place.', 'We found another place, no longer needed.'],
    vague: ['depends', 'Hmm, let me think about it', 'will tell you later', 'I\'ll check with my partner'],
    confuse: ['??', 'hmm what', 'k k'],
    thanks: ['Thank you!', 'Thanks, see you there.'],
    okThanks: ['Okay, thanks.', 'Okay.'],
    words: ['The first one.', 'The second one.', 'The third one.'],
    faq: { gst: 'Is GST extra on the rent?', deposit: 'How much is the security deposit?', lockin: 'What is the lock-in period?', parking: 'How many car parks does it have?', maint: 'What is the maintenance charge?', photos: 'Can you send photos of the first one?', location: 'Can you share the location?' },
  },
  hi: {
    negotiate: ['क्या मालिक किराया थोड़ा कम कर सकते हैं?'],
    legal: ['Stamp duty aur registration kaun dega?', 'स्टैम्प ड्यूटी और registration कौन देगा?'],
    upset: ['ये बहुत bakwas service है, किसी ने कॉल नहीं किया।'],
    human: ['Please mujhe call karo.', 'प्लीज़ call karo.'],
    lost: ['धन्यवाद, हमें दूसरी जगह मिल गई है, not interested.'],
    vague: ['अभी पता नहीं', 'देखते हैं', 'बाद में बताता हूँ'],
    confuse: ['क्या?', 'हम्म'],
    thanks: ['धन्यवाद!'],
    okThanks: ['ठीक है, धन्यवाद।'],
    words: ['पहला वाला', 'दूसरा वाला', 'तीसरा वाला'],
    faq: { gst: 'किराए पर GST अलग से लगेगा क्या?', deposit: 'सिक्योरिटी डिपॉजिट कितना है?', lockin: 'लॉक-इन कितने महीने का है?', parking: 'पार्किंग कितनी है?', maint: 'मेंटेनेंस कितना लगेगा?', photos: 'फोटो भेज सकते हैं क्या?', location: 'लोकेशन भेज दीजिए?' },
  },
  od: {
    negotiate: ['ମୂଲ୍ୟ କମ ହୋଇପାରିବ କି?', 'ମାଲିକ ଭଡା ଟିକେ ମୂଲ୍ୟ କମ କରିବେ କି?'],
    legal: ['Stamp duty ଓ registration କିଏ ଦେବେ?'],
    upset: ['ଏହା ବହୁତ ଖରାପ ସେବା, କେହି କଲ କଲେ ନାହିଁ।'],
    human: ['ଦୟାକରି ମୋତେ କଲ କରନ୍ତୁ।'],
    lost: ['ଧନ୍ୟବାଦ, ଆମେ ଅନ୍ୟ ଜାଗା ପାଇଗଲୁ, not interested।'],
    vague: ['ଏବେ ଜଣାନାହିଁ', 'ଦେଖିବା', 'ପରେ କହିବି'],
    confuse: ['କଣ?', 'ହୁଁ ହୁଁ'],
    thanks: ['ଧନ୍ୟବାଦ!'],
    okThanks: ['ଠିକ୍ ଅଛି, ଧନ୍ୟବାଦ।'],
    words: ['ପ୍ରଥମଟି', 'ଦ୍ୱିତୀୟଟି', 'ତୃତୀୟଟି'],
    faq: { gst: 'GST ଅଲଗା ଲାଗିବ କି?', deposit: 'Deposit କେତେ ଟଙ୍କା?', lockin: 'Lock-in କେତେ ମାସ?', parking: 'Parking କେତୋଟି ଅଛି?', maint: 'Maintenance କେତେ ଲାଗିବ?', photos: 'ଫଟୋ ପଠାଇପାରିବେ କି?', location: 'Location ପଠାନ୍ତୁ।' },
  },
};
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateWords = (d) => d.getDate() + ' ' + MONTH_FULL[d.getMonth()];
const lakhWords = (n) => (n / 1e5).toFixed(2).replace(/\.?0+$/, '');
const LANG_OF = { en: 'English', hi: 'Hindi', od: 'Odia' };
const ODIA_DIG = ['୦', '୧', '୨', '୩'], HINDI_DIG = ['०', '१', '२', '३'];

/* the sentences a persona will say for each question, generated from its "truth" requirement */
function genSay(p) {
  const lk = p.lk, t = p.truth, u = t.use, say = {};
  const sm = LC.reqSizeMid(t);
  say.use = rpick(USE_SENT[lk][u] || USE_SENT[lk].Office);
  if (t.seats && !t.sizeMin) say.size = lk === 'en' ? rpick([`A team of ${t.seats}.`, `${t.seats} seats.`]) : lk === 'hi' ? `${t.seats} seats चाहिए।` : `${t.seats} seats ଦରକାର।`;
  else {
    const r = `${LC.fmtNum(t.sizeMin)}${rchance(.5) ? '-' : ' to '}${LC.fmtNum(t.sizeMax)} sq ft`;
    const single = `${LC.fmtNum(Math.round(sm / 50) * 50)} sq ft`;
    const x = rchance(.7) ? r : single;
    say.size = lk === 'en' ? rpick([`About ${x}.`, `${x} would be fine.`, `Around ${x}.`]) : lk === 'hi' ? `लगभग ${x} चाहिए।` : `ପ୍ରାୟ ${x} ଦରକାର।`;
  }
  if (t.budgetPsf) {
    const monthlyRaw = t.budgetPsf * sm;
    if (rchance(.3)) {
      const M = monthlyRaw >= 1e5 ? lakhWords(monthlyRaw) + (lk === 'en' ? ' lakh' : lk === 'hi' ? ' लाख' : ' ଲକ୍ଷ') : '₹' + LC.fmtNum(Math.round(monthlyRaw / 5000) * 5000);
      say.budget = lk === 'en' ? `My budget is about ${M} a month all-in.` : lk === 'hi' ? `महीने का बजट लगभग ${M} है।` : `ମାସିକ ବଜେଟ୍ ପ୍ରାୟ ${M}।`;
    } else say.budget = lk === 'en' ? rpick([`Around ₹${t.budgetPsf} per sq ft all-in.`, `₹${t.budgetPsf} per sq ft including maintenance.`, `Budget is ₹${t.budgetPsf} per sq ft.`]) : lk === 'hi' ? `बजट ₹${t.budgetPsf} per sq ft है।` : `ବଜେଟ୍ ₹${t.budgetPsf} per sq ft।`;
  }
  const loc = p.locTxt;
  say.location = p.cityLevel ? (lk === 'en' ? `Anywhere in ${loc} is fine.` : lk === 'hi' ? `${loc} में कहीं भी चलेगा।` : `${loc} ଭିତରେ ଯେକୌଣସି ଜାଗା ଚଳିବ।`) : lk === 'en' ? rpick([`Near ${loc}.`, `${loc} area.`]) : lk === 'hi' ? `${loc} के पास।` : `${loc} ପାଖରେ।`;
  const md = LC.parseDate(t.moveIn), off = LC.daysBetween(LC.today(), md);
  if (lk === 'en' && off < 90 && off >= 14 && rchance(.4)) say.moveIn = `In ${Math.round(off / 7)} weeks.`;
  else say.moveIn = lk === 'en' ? rpick([`By ${dateWords(md)}.`, `Around ${dateWords(md)}.`, `We want to move in by ${dateWords(md)}.`]) : lk === 'hi' ? `${dateWords(md)} तक चाहिए।` : `${dateWords(md)} ସୁଦ୍ଧା ଦରକାର।`;
  const F = t.furnishing;
  say.furnishing = ({
    en: { 'Plug-and-play': ['Ready to use, plug and play.', 'Plug and play please.'], 'Semi-furnished': ['Semi-furnished is fine.'], 'Warm shell': ['Warm shell is fine.'], 'Bare shell': ['We\'ll do our own interiors.'] },
    hi: { 'Plug-and-play': ['Plug and play चाहिए।'], 'Semi-furnished': ['Semi-furnished चलेगा।'], 'Warm shell': ['Warm shell चलेगा।'], 'Bare shell': ['हम अपना own interior करेंगे।'] },
    od: { 'Plug-and-play': ['Plug and play ଦରକାର।'], 'Semi-furnished': ['Semi-furnished ଚଳିବ।'], 'Warm shell': ['Warm shell ଚଳିବ।'], 'Bare shell': ['ଆମେ own interior କରିବୁ।'] },
  })[lk][F];
  say.furnishing = rpick(say.furnishing);
  const n = t.parking4w || 0;
  say.parking4w = n > 0 ? (lk === 'en' ? rpick([`${n} car parks.`, `I need ${n} car parking spaces.`]) : lk === 'hi' ? `${n} car parking चाहिए।` : `${n} car parking ଦରକାର।`) : (lk === 'en' ? rpick(['No parking needed.', 'None.']) : lk === 'hi' ? 'Parking nahi chahiye.' : 'Parking ଦରକାର ନାହିଁ।');
  return say;
}

/* the first inbound text, which depends on the source */
function genFirst(p) {
  const t = p.truth, lk = p.lk, src = p.source, loc = p.locTxt, u = t.use;
  const sm = LC.reqSizeMid(t);
  const sizeTxt = (t.seats && !t.sizeMin) ? `${t.seats} seats` : `${LC.fmtNum(Math.round(sm / 50) * 50)} sq ft`;
  const lang = LANG_OF[lk], who = `Name: ${p.name}. Company: ${p.company}. Language: ${lang}.`;
  if (src === 'Phone call (IVR)') return { text: `Missed call from ${p.phone}. IVR language: ${lang}.`, ivr: true };
  if (['99acres', 'Magicbricks', 'Housing.com'].includes(src)) return { text: `[${src}] Enquiry for ${sizeTxt} ${USE_EN[u]}, ${loc}. ${who}` };
  if (src === 'JustDial') return { text: `[JustDial] Lead: ${USE_EN[u]} on rent, ${loc}. ${who}` };
  if (src === 'Meta lead ads' || src === 'Google Ads') {
    const bud = t.budgetPsf ? ` · Budget: ₹${t.budgetPsf} per sq ft` : '';
    const size = (t.seats && !t.sizeMin) ? ` · Size: ${t.seats} seats` : ` · Size: ${LC.fmtNum(t.sizeMin)}–${LC.fmtNum(t.sizeMax)} sq ft`;
    const area = (src === 'Meta lead ads' || rchance(.4)) ? ` · Area: ${loc}` : '';
    return { text: `${src === 'Meta lead ads' ? 'Meta lead form' : 'Google Ads form'}: Requirement: ${u === 'F&B' ? 'Restaurant' : u === 'Institutional' ? 'Coaching centre' : u}${bud}${size}${area}. ${who}` };
  }
  if (src === 'Walk-in') return { text: `Walk-in at the office, entered by the front desk. ${who} Needs ${USE_EN[u]} near ${loc}, about ${sizeTxt}.` };
  const lvl = p.lvl;   // free text: 0 = use only, 1 = use and area, 2 = use, area and size
  let s;
  if (lk === 'en') s = `Hi, this is ${p.name} from ${p.company}. I'm ${EN_BASE[u]}.` + (lvl >= 1 ? ` Near ${loc}.` : '') + (lvl >= 2 ? ` About ${sizeTxt}.` : '');
  else if (lk === 'hi') s = `नमस्ते, मुझे ${USE_SHORT.hi[u]} के लिए जगह चाहिए।` + (lvl >= 1 ? ` ${loc} के पास।` : '') + (lvl >= 2 ? ` लगभग ${sizeTxt}।` : '');
  else s = `ନମସ୍କାର, ମୋତେ ${USE_SHORT.od[u]} ପାଇଁ ଜାଗା ଦରକାର।` + (lvl >= 1 ? ` ${loc} ପାଖରେ।` : '') + (lvl >= 2 ? ` ପ୍ରାୟ ${sizeTxt}।` : '');
  if (src === 'Website form') s = `Website form. Name: ${p.name}. Company: ${p.company}. Message: ${s}`;
  if (src === 'Referral') s = `Referred by Mr. Mishra. ${s}`;
  return { text: s };
}

/* Merge a message into a requirement the way the AI agent does. Pure function, also used to test personas. */
const BUDGET_MARK = /(budget|rent|₹|\brs\b|inr|lakh|lac|लाख|ଲକ୍ଷ|per month|monthly|\/month|psf|per sq|\/sq|बजट|ବଜେଟ)/i;
const LOOSE_OK = {
  furnishing: /(\byes\b|\bno\b|\bnahi\b|haan|\bha\b|\bown\b|ourselves|ready|plug|shell|furnish|interior|fit.?out|ହଁ|ନାହିଁ|हाँ|नहीं|खुद)/i,
  parking4w: /(\d|\bno\b|none|nahi|zero|parking|ନାହିଁ|नहीं|पार्किंग|ପାର୍କିଂ)/i,
};
function mergeParse(base, text, expect) {
  const lower = String(text).toLowerCase();
  let ex = expect;
  if (LOOSE_OK[ex] && !LOOSE_OK[ex].test(lower)) ex = null;
  const p = LC.parseRequirement(text, base, { expect: ex });
  const req = p.req; let found = p.found.slice();
  if (found.some(f => f.key === 'budget') && ex !== 'budget' && !BUDGET_MARK.test(lower)) {
    req.budgetPsf = base.budgetPsf; req.budgetMonthly = base.budgetMonthly; found = found.filter(f => f.key !== 'budget');
  }
  const got = Array.from(new Set(found.map(f => f.key).filter(k => LC.REQ_FIELDS.some(r => r.key === k))));
  return { req, got, found, intents: p.intents, hit: expect ? got.includes(expect) : false };
}
const INTENT_KEYS = ['negotiate', 'legal', 'complaint', 'human', 'notInterested', 'stop'];
const anyIntent = (i) => INTENT_KEYS.some(k => i[k]);

const isLarge = (req) => {
  const S = LC.settings(); const mid = LC.reqSizeMid(req) || 0;
  const monthly = req.budgetMonthly || ((req.budgetPsf || 0) * mid);
  return mid > S.largeDealSqft || monthly > S.largeDealMonthly;
};

/* ---- build one persona; retries until the answers parse cleanly and the kind behaves as intended ---- */
const SPECIAL_UNITS = () => LC.state.units.filter(u => LC.isMatchable(u) && !u.data_flag);
function makeTruth(kind, u) {
  const r = LC.reqAroundUnit(u, true);
  r.powerBackup = null; r.mustHave = [];
  r.budgetPsf = Math.round(u.all_in_per_sqft * (1.0 + rng() * 0.08));
  r.furnishing = rpick(['Plug-and-play', 'Warm shell', 'Bare shell', 'Semi-furnished']);
  const days = (f) => LC.daysBetween(LC.today(), LC.readyDate(u, f)) + rint(2, 8);
  let off = Math.max(12, days(r.furnishing));
  if (kind === 'nurture') off = rint(108, 165);
  else if (off > 78) { r.furnishing = u.furnishing; off = Math.max(12, days(r.furnishing)); if (off > 78) return null; }
  r.moveIn = LC.iso(LC.addDays(LC.today(), off));
  return r;
}
function noMatchTruth() {
  const r = LC.emptyReq(); r.use = 'Warehouse'; r.sizeMin = 2600; r.sizeMax = 3400; r.budgetPsf = 24; r.localities = []; r.city = 'Puri';
  r.moveIn = LC.iso(LC.addDays(LC.today(), rint(20, 60))); r.furnishing = 'Bare shell'; r.parking4w = 0;
  return r;
}
function tryPersona(kind, o) {
  const lk = o.lk, S = LC.settings();
  const p = { kind, lk, lang: LANG_OF[lk], source: o.source, lvl: rint(0, 2), cityLevel: false, nAns: 0, said: 0, quiet: false, confCount: 0, thanked: false, faqDone: false, negDone: false, vagueDone: false };
  let u = null;
  if (kind === 'nomatch') { p.truth = noMatchTruth(); p.truth.localities = []; }
  else {
    const pool = SPECIAL_UNITS().filter(x => kind === 'large' ? x.chargeable_sqft >= 5200 && x.chargeable_sqft <= 9000 : x.chargeable_sqft <= 4400);
    if (!pool.length) return null;
    u = rpick(pool); p.truth = makeTruth(kind, u); if (!p.truth) return null;
  }
  p.unit = u ? u.unit_id : null;
  p.cityLevel = kind !== 'nomatch' && rchance(.4);
  p.locTxt = p.cityLevel ? p.truth.city : (p.truth.localities[0] || p.truth.city);
  const ex = o.existing;
  if (ex) { p.name = ex.name; p.company = ex.company || rpick(P_COMP.Office); p.phone = ex.phone; p.existing = ex; }
  else { p.name = rpick(P_FIRST) + ' ' + rpick(P_LAST); p.company = rpick(P_COMP[p.truth.use] || P_COMP.Office); p.phone = LC.fakePhone(); }
  if (p.source === 'Phone call (IVR)') { p.callerName = p.name; p.callerCompany = p.company; }
  p.say = genSay(p);
  const f = genFirst(p); p.first = f;
  if (f.ivr) p.say.use = `Hello, this is ${p.name} from ${p.company}. ` + p.say.use;
  // faq, picks, special lines
  const faqKeys = ['gst', 'deposit', 'lockin', 'parking', 'maint'];
  p.faqKey = rpick(faqKeys); p.faqText = PL[lk].faq[p.faqKey]; p.faqWanted = rchance(.35);
  p.pickStyle = rchance(.6) ? 'digit' : 'word';
  p.interruptAt = rint(1, 3); p.slowAfter = rint(1, 3);
  const L = PL[lk];
  p.lines = { negotiate: rpick(L.negotiate), legal: rpick(L.legal), upset: rpick(L.upset), human: rpick(L.human), lost: rpick(L.lost), thanks: rpick(L.thanks), okThanks: rpick(L.okThanks) };
  // ---- validate by running the same merge path the agent runs ----
  let R = LC.emptyReq(), given = [];
  if (!f.ivr) { const m = mergeParse(R, f.text, null); R = m.req; given = m.got; if (anyIntent(m.intents)) return null; if (R.use && R.use !== p.truth.use) return null; }
  if (kind === 'vague' || kind === 'confusing') {
    const cand = ['size', 'budget', 'moveIn'].filter(k => !given.includes(k));
    if (kind === 'vague') { if (!cand.length) return null; p.vagueKey = rpick(cand); }
    if (kind === 'vague') p.vagueText = rpick(L.vague);
    const bad = (t, keys) => keys.some(k => { const m = mergeParse(LC.emptyReq(), t, k); return m.got.length || anyIntent(m.intents); });
    if (L.vague.some(t => bad(t, ['size', 'budget', 'moveIn'])) || L.confuse.some(t => bad(t, ['use', 'size', 'budget', 'location', 'moveIn', 'furnishing', 'parking4w']))) return null;
  }
  for (const k of LC.REQ_FIELDS.map(r => r.key)) {
    if (LC.reqHas(R, k)) continue;
    const m = mergeParse(R, p.say[k], k);
    if (!m.hit) return null;
    if (anyIntent(m.intents)) return null;
    R = m.req;
  }
  p.parsed = R;
  const mid = LC.reqSizeMid(R);
  if (kind === 'nomatch') { if (isLarge(R) || LC.match(R, { limit: 3 }).exact.length) return null; }
  else if (kind === 'large') { if (!isLarge(R)) return null; }
  else {
    if (isLarge(R)) return null;
    const far = LC.daysBetween(LC.today(), R.moveIn) > 90;
    if (kind === 'nurture' ? !far : far) return null;
    if (kind !== 'nurture') { const m = LC.match(R, { limit: 3 }); if (!m.exact.length || m.exact[0].score < S.minMatchScore + 8) return null; }
  }
  const need = { negotiator: ['negotiate', 'negotiate'], legal: ['legal', 'legal'], upset: ['upset', 'complaint'], human: ['human', 'human'], lost: ['lost', 'notInterested'] }[kind];
  if (need && !LC.parseRequirement(p.lines[need[0]], null, {}).intents[need[1]]) return null;
  return p;
}
function buildPersona(kind, o) {
  for (let i = 0; i < 40; i++) { const p = tryPersona(kind, o); if (p) return p; }
  if (kind !== 'coop') return buildPersona('coop', o);
  throw new Error('Could not build a persona');
}

/* choose kinds, languages and sources for n leads. At 30 or more, every rule and every source appears. */
const KIND_W = [['coop', 56], ['vague', 8], ['confusing', 3], ['negotiator', 6], ['legal', 3], ['upset', 3], ['human', 4], ['large', 3], ['nomatch', 3], ['slow', 5], ['nurture', 5], ['lost', 4], ['existing', 5]];
const SRC_W = [['99acres', 16], ['Magicbricks', 14], ['Housing.com', 6], ['Website form', 10], ['Meta lead ads', 12], ['Google Ads', 8], ['JustDial', 7], ['Office WhatsApp', 11], ['Phone call (IVR)', 6], ['Referral', 7], ['Walk-in', 3]];
const SPECIALS = ['confusing', 'negotiator', 'legal', 'upset', 'human', 'large', 'nomatch', 'slow', 'slow', 'nurture', 'nurture', 'lost', 'existing', 'existing', 'vague', 'vague'];
function buildDeck(n) {
  let kinds = n >= 24 ? SPECIALS.slice() : [];
  while (kinds.length < n) kinds.push(wpick(KIND_W));
  kinds = rshuffle(kinds.slice(0, Math.max(n, 0)));
  const nEn = Math.round(n * .6), nOd = Math.round(n * .25);
  const langs = rshuffle(Array.from({ length: n }, (_, i) => i < nEn ? 'en' : i < nEn + nOd ? 'od' : 'hi'));
  let srcs = n >= 11 ? LC.SOURCES.slice() : []; while (srcs.length < n) srcs.push(wpick(SRC_W)); srcs = rshuffle(srcs.slice(0, n));
  return kinds.map((k, i) => ({ kind: k, lk: langs[i], source: srcs[i] }));
}

/* =====================================================================
   Clock, event queues, lead objects
   ===================================================================== */
let simNow = 0, paused = false, active = false, speed = 1, teamWorks = true, finishedOnce = false;
const simQ = [], realQ = [];
const dirty = { ids: new Set(), leads: false };
const fireOrder = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9'];
const qInsert = (q, ev) => { let i = q.length; while (i > 0 && q[i - 1].t > ev.t) i--; q.splice(i, 0, ev); };
let evT = null, evR = null;                  // time of the event being processed, so cascaded events keep exact spacing
const clock = (lead) => lead._test ? (evR != null ? evR : Date.now()) : (evT != null ? evT : simNow);
function later(lead, ms, fn) { const ev = { fn, lead }; if (lead._test) { ev.t = (evR != null ? evR : Date.now()) + ms; qInsert(realQ, ev); } else { ev.t = (evT != null ? evT : simNow) + ms; qInsert(simQ, ev); } }
function touch(lead) { lead._ver = (lead._ver || 0) + 1; dirty.ids.add(lead.id); dirty.leads = true; }
function addMsg(lead, from, text, extra) {
  const m = Object.assign({ from, text, ts: Date.now() }, extra); lead.messages.push(m); lead.lastAt = m.ts; touch(lead);
  /* SERVER HOOK (added for the Node runtime, no change in behaviour): lets a channel module (WhatsApp) see every message
     the moment it is appended, with cards and quick replies already attached. Not set in the browser. */
  if (typeof LC.onMessage === 'function') { try { LC.onMessage(lead, m); } catch (err) { console.error('[inbox] onMessage', err); } }
  return m;
}
const leadById = (id) => LC.state.leads.find(l => l.id === id);
const fieldLabel = (k) => (LC.REQ_FIELDS.find(f => f.key === k) || {}).label || k;
const unitLine = (u) => LC.unitShort(u);
const deskMin = (simMs) => simMs * SLA_SCALE / 60000;      // simulated ms -> desk minutes
const fmtMin = (m) => m < 1 ? 'under 1 min' : Math.round(m) + ' min';

function createLead(o) {
  const lead = {
    id: LC.uid('ld'), clientId: null, name: o.name, company: o.company || '', phone: o.phone, source: o.source, language: o.language,
    status: 'ai', createdAt: Date.now(), lastAt: Date.now(), firstReplyMs: null, messages: [], req: LC.emptyReq(), matches: [], visitId: null, handoff: null, rulesFired: [],
    _e: { stage: 'new', expect: null, qCount: 0, fails: 0, skipped: {}, awaiting: false, waitSince: 0, nudges: 0, h5: false, nurtured: false, focus: null, slots: [], pickFails: 0, slotFails: 0, heldAck: false, t0: null, agentSet: false, optOut: false, agentMsgs: 0 },
    _p: o.persona || null, _test: !!o.test, _ver: 0, _typing: false,
  };
  LC.state.leads.push(lead); touch(lead); return lead;
}

/* =====================================================================
   The AI leasing agent (deterministic)
   ===================================================================== */
const FAQ_RX = {
  photos: /photos?|pictures?|\bpics?\b|images?|फोटो|तस्वीर|ଫଟୋ/i,
  location: /location|where is|where exactly|address|\bmap\b|कहाँ|कहां|लोकेशन|ଠିକଣା|ଲୋକେସନ/i,
  gst: /\bgst\b|जीएसटी|ଜିଏସଟି/i,
  deposit: /deposit|डिपॉजिट|डिपॉज़िट|ଡିପୋଜିଟ/i,
  lockin: /lock.?in|लॉक/i,
  maint: /maintenance|\bcam\b|मेंटेनेंस|ମେଣ୍ଟେନାନ୍ସ/i,
  parking: /parking|car parks?|पार्किंग|ପାର୍କିଂ/i,
};
const FAQ_ORDER = ['photos', 'location', 'gst', 'deposit', 'lockin', 'maint', 'parking'];
const FAQ_NEEDS_Q = { gst: 1, deposit: 1, lockin: 1, maint: 1, parking: 1 };
const looksQuestion = (t) => /\?|^(what|how|is|are|does|do|can|could|will|where|which|who|when|kya|kitna|kitne|kahan)\b|क्या|कितन|कहाँ|କି |କି$|କେତେ|କଣ|ଅଛି/i.test(String(t).trim());
function faqTopic(text) {
  const q = looksQuestion(text);
  for (const k of FAQ_ORDER) if (FAQ_RX[k].test(text) && (q || !FAQ_NEEDS_Q[k])) return k;
  return null;
}
function faqPart(lead, topic, unit) {
  const F = TXT[LK(lead)].faq;
  if (topic === 'gst') return { k: 'ai', text: F.gst };
  if (!unit) return { k: 'ai', text: F.generic };
  if (topic === 'photos') return { k: 'ai', text: F.photos(unit), cards: [unit.unit_id], fit: {} };
  if (topic === 'location') return { k: 'ai', text: F.location(unit, LC.mapsLink(unit)) };
  return { k: 'ai', text: F[topic](unit) };
}
const ORD = [/\b(first|1st|pehla|pehle|pahla|top|best)\b|पहला|पहली|ପ୍ରଥମ/, /\b(second|2nd|doosra|dusra)\b|दूसरा|दूसरी|ଦ୍ୱିତୀୟ|ଦ୍ଵିତୀୟ/, /\b(third|3rd|teesra|tisra)\b|तीसरा|तीसरी|ତୃତୀୟ/];
function parsePick(text, n, lead) {
  const t = normDigits(text).toLowerCase().trim();
  let m = t.match(/^\D{0,14}([1-3])\D{0,14}$/);
  if (m && +m[1] <= n) return +m[1] - 1;
  for (let i = 0; i < Math.min(n, 3); i++) if (ORD[i].test(t)) return i;
  for (let i = 0; i < lead.matches.length; i++) { const u = LC.unit(lead.matches[i]); if (u && t.includes(u.building_name.toLowerCase())) return i; }
  return -1;
}
function parseSlot(text, slots) {
  const t = normDigits(text).toLowerCase().replace(/\s+/g, ' ').trim();
  let i = slots.findIndex(ts => LC.fmtDT(ts).toLowerCase() === t); if (i >= 0) return i;
  const m = t.match(/^\D{0,10}([1-3])\D{0,10}$/); if (m && +m[1] <= slots.length) return +m[1] - 1;
  for (let k = 0; k < Math.min(3, slots.length); k++) if (ORD[k].test(t)) return k;
  let best = -1, bs = 1;
  slots.forEach((ts, k) => {
    const d = new Date(ts); let s = 0; const h = d.getHours(), h12 = h % 12 || 12;
    if (t.includes(LC.WD[d.getDay()].toLowerCase())) s += 2;
    if (new RegExp('\\b' + h12 + '(:00)?\\s*' + (h >= 12 ? 'pm' : 'am')).test(t)) s += 2;
    if (new RegExp('\\b' + d.getDate() + '\\b').test(t)) s += 1;
    if (s > bs) { bs = s; best = k; }
  });
  return best;
}
function detectLang(lead, text) {
  let l = null;
  if (/[଀-୿]/.test(text)) l = 'Odia';
  else if (/[ऀ-ॿ]/.test(text)) l = 'Hindi';
  else { const m = text.match(/[Ll]anguage:\s*(English|Hindi|Odia)/); if (m) l = m[1]; else if (/\b(kya|chahiye|mujhe|hum|aap|nahi|kaun|kitna|karo|hai|hain)\b/i.test(text)) l = 'Hindi'; }
  if (l && l !== lead.language) { lead.language = l; if (lead.clientId) LC.crm.update(lead.clientId, { language: l }); }
}
function extractWho(text) {
  const n = text.match(/Name:\s*([^.·|\n]+?)\s*(?:\.|·|\||$)/), c = text.match(/Company:\s*([^.·|\n]+?)\s*(?:\.|·|\||$)/);
  return { name: n ? n[1].trim() : null, company: c ? c[1].trim() : null };
}
const greetName = (lead) => /^(Caller|Test)/.test(lead.name) ? '' : first(lead.name);

/* ---- handoff ---- */
function fireRule(lead, id, reason, parts, o = {}) {
  if (!ruleOn(id)) return false;
  const e = lead._e, S = LC.settings(), r = ruleDef(id), lk = LK(lead), T = TXT[lk];
  const senior = id === 'H3' || id === 'H5';
  const assignee = o.assignee || (senior ? ME_SENIOR : LC.crm.assignAgent(lead.req, lead.language));
  const q = LC.queue.add({ leadId: lead.id, clientId: lead.clientId, rule: id, reason, priority: senior ? 'High' : 'Normal', assignee });
  q._simDue = simNow + S.slaMinutes * 60e3 / SLA_SCALE; q.slaDue = Date.now() + (q._simDue - simNow) / speed;
  lead.handoff = { rule: id, reason, at: Date.now(), queueId: q.id, assignee, simAt: simNow, priority: q.priority };
  lead.status = 'handoff'; lead.rulesFired.push(id); e.awaiting = false; e.heldFrom = e.stage; e.heldAck = false; e.heldRule = id;
  if (lead.clientId && !o.keepAgent) LC.crm.update(lead.clientId, { agent: assignee });
  if (lead.clientId) LC.crm.addActivity(lead.clientId, 'handoff', 'Handed to ' + assignee + ' (' + r.name + '): ' + reason, 'AI agent');
  parts.push({ k: 'sys', text: 'Rule ' + id + ': ' + r.name + '. ' + reason + '. Handed to ' + assignee + ', who should respond within ' + S.slaMinutes + ' minutes.' });
  const f = first(assignee), ho = T.ho[id] || T.ho.generic;
  parts.push({ k: 'ai', text: ho(f, S.slaMinutes, GENDER[f] || 'm') });
  if (!lead._test) lead._pickAt = simNow + (S.slaMinutes * 60e3 / SLA_SCALE) * (0.35 + rng() * 1.9);
  return true;
}
function offNote(lead, id, parts) { parts.push({ k: 'ai', text: TXT[LK(lead)].off[id] }); }

function logConsent(lead) {
  LC.state.consent.push({ ts: Date.now(), phone: lead.phone, name: lead.name, channel: 'WhatsApp', text: 'Consent line shown: "You can reply STOP at any time" (first message, ' + lead.source + ')' });
}

/* push the parts the agent decided on, in order */
function flushParts(lead, parts) {
  const e = lead._e;
  parts.forEach((p, i) => {
    if (p.k === 'sys') addMsg(lead, 'system', p.text);
    else {
      /* cards and quick replies are passed to addMsg so the SERVER HOOK (LC.onMessage) sees the finished message */
      const extra = { by: 'AI agent' };
      if (p.cards) { extra.cards = p.cards; extra.fit = p.fit || {}; }
      if (p.quick) extra.quick = p.quick;
      const m = addMsg(lead, 'ai', p.text, extra);
      if (lead.firstReplyMs == null) {
        lead.firstReplyMs = Math.max(200, clock(lead) - (e.t0 == null ? clock(lead) : e.t0));
        if (lead.clientId) { const c = LC.crm.get(lead.clientId); if (c) { c.firstReplySec = Math.max(1, Math.round(lead.firstReplyMs / 1000)); LC.crm.addActivity(lead.clientId, 'message', 'AI replied on WhatsApp in ' + c.firstReplySec + ' s and started qualifying', 'AI agent'); } }
      }
    }
  });
  if (e.awaiting) e.waitSince = clock(lead);
  touch(lead);
  if (lead._p) personaNext(lead);
}

function aiRespond(lead, text, opts) {
  const e = lead._e, S = LC.settings(), parts = [];
  if (lead.status === 'human') return;
  if (opts.ivr == null) opts.ivr = false;
  if (!opts.resume) detectLang(lead, text);
  const lk = LK(lead), T = TXT[lk];
  const say = (txt, x) => parts.push(Object.assign({ k: 'ai', text: txt }, x));
  const sysm = (txt) => parts.push({ k: 'sys', text: txt });
  const done = () => flushParts(lead, parts);
  const unitFor = (idx) => { const id = idx != null && idx >= 0 ? lead.matches[idx] : (e.focus || lead.matches[0]); return id ? LC.unit(id) : null; };

  /* ---- hand back from a person: carry on where the conversation stopped ---- */
  if (opts.resume) {
    if (e.stage === 'qualify') {
      const miss = LC.REQ_FIELDS.map(f => f.key).filter(k => !LC.reqHas(lead.req, k) && !e.skipped[k]);
      if (!miss.length && !lead.matches.length) { say(T.back); return done(); }
      return advance([T.back]);
    }
    if (e.stage === 'pick') { say(T.back + '\n\n' + T.pickPrompt(lead.matches.length), { quick: lead.matches.map((_, i) => String(i + 1)) }); e.awaiting = true; return done(); }
    if (e.stage === 'slot') { say(T.back + '\n\n' + T.slotOffer(unitLine(LC.unit(e.focus))), { quick: e.slots.map(ts => LC.fmtDT(ts)) }); e.awaiting = true; return done(); }
    say(T.back); return done();
  }

  /* ---- statuses that need special handling ---- */
  const simpleAck = /^(ok|okay|thanks?|thank you|noted|fine|sure|done)\b|^(धन्यवाद|ठीक है|ଧନ୍ୟବାଦ|ଠିକ୍ ଅଛି)/i.test(String(text).trim()) && String(text).length < 40;
  if (lead.status === 'handoff') {
    if (simpleAck) return;
    const topic = faqTopic(text);
    if (topic) { const idx = lead.matches.length ? parsePick(text, lead.matches.length, lead) : -1; parts.push(faqPart(lead, topic, unitFor(idx))); }
    else if (!e.heldAck) { e.heldAck = true; say(T.held(first(lead.handoff ? lead.handoff.assignee : 'our team'))); }
    return done();
  }
  let welcomeBack = false;
  if (lead.status === 'closed' || lead.status === 'nurture') {
    if (simpleAck) return;
    if (e.optOut && !/^start\b/i.test(text.trim())) return;
    welcomeBack = true; e.optOut = false; lead.status = 'ai'; e.nurtured = true; e.fails = 0;
    if (lead.clientId) { const c = LC.crm.get(lead.clientId); if (c && (c.stage === 'Lost' || c.stage === 'Nurture')) LC.crm.moveStage(lead.clientId, LC.reqIsQualified(lead.req) ? 'Qualified' : 'New enquiry', 'AI agent', 'Occupier wrote back'); }
    e.stage = lead.visitId ? 'booked' : lead.matches.length ? 'pick' : 'qualify';
  }

  const isFirst = e.stage === 'new';
  const merging = e.stage === 'new' || e.stage === 'qualify';       // requirement fields are only read while qualifying
  const faq = opts.ivr ? null : faqTopic(text);
  const mp = opts.ivr ? { req: lead.req, got: [], found: [], intents: {}, hit: false } : mergeParse(lead.req, text, merging ? e.expect : null);
  const I = mp.intents;
  const answeredQ = !!(faq && !mp.hit);        // a question about a topic, not an answer
  if (merging && !answeredQ && !opts.ivr) lead.req = mp.req;
  if (!merging) mp.got = [];
  if (merging && !answeredQ && mp.req.contactName && /^(Caller|Test)/.test(lead.name)) { lead.name = mp.req.contactName; if (lead.clientId) LC.crm.update(lead.clientId, { name: lead.name }); }
  if (merging && !answeredQ && mp.req.company && !lead.company) { lead.company = mp.req.company; if (lead.clientId) LC.crm.update(lead.clientId, { company: lead.company }); }

  /* ---- first contact: consent, existing client (H9) or a new client ---- */
  if (isFirst) {
    e.stage = 'qualify'; logConsent(lead);
    const who = extractWho(text);
    if (who.name && /^(Caller|Test)/.test(lead.name)) lead.name = who.name;
    if (who.company && !lead.company) lead.company = who.company;
    const existing = ruleOn('H9') ? LC.crm.findByPhone(lead.phone) : null;
    if (existing) {
      lead.clientId = existing.id; lead.existing = true; lead.name = existing.name; lead.company = existing.company || lead.company;
      LC.crm.addActivity(existing.id, 'message', 'New WhatsApp enquiry from ' + lead.source + '. Routed to ' + existing.agent + '; no new client created.', 'AI agent');
      say(T.greet(greetName(lead)));
      fireRule(lead, 'H9', 'Phone number already belongs to ' + (existing.company || existing.name) + ' (' + existing.stage + ')', parts, { assignee: existing.agent, keepAgent: true });
      return done();
    }
    const c = LC.crm.add({ name: lead.name, company: lead.company, phone: lead.phone, source: lead.source, language: lead.language, req: JSON.parse(JSON.stringify(lead.req)), agent: LC.crm.assignAgent(lead.req, lead.language), by: 'AI agent', leadId: lead.id });
    lead.clientId = c.id;
    if (lead._test) c.notes = 'Created from the "Test as an occupier" chat.';
  } else if (mp.got.length && !answeredQ && lead.clientId) {
    LC.crm.setReq(lead.clientId, lead.req, 'AI agent');
  }
  if (isFirst && mp.got.length && lead.clientId) LC.crm.setReq(lead.clientId, lead.req, 'AI agent');

  const lead0 = [];                               // text pieces that go before the next question
  if (isFirst) lead0.push(T.greet(greetName(lead)));
  else if (welcomeBack) lead0.push(T.welcomeBack);

  /* ---- opt out and not interested ---- */
  if (I.stop) { LC.state.consent.push({ ts: Date.now(), phone: lead.phone, name: lead.name, channel: 'WhatsApp', text: 'Consent withdrawn: replied STOP. No further messages.', optOut: true }); lead.status = 'closed'; e.optOut = true; e.awaiting = false; e.closedWhy = 'Opted out (STOP)'; say(T.stop); if (lead.clientId) { LC.crm.moveStage(lead.clientId, 'Lost', 'AI agent', 'Opted out of messages'); LC.crm.update(lead.clientId, { lostReason: 'Opted out of messages' }); } return done(); }
  if (I.notInterested && !isFirst) {
    lead.status = 'closed'; e.awaiting = false; e.closedWhy = 'Found another place';
    if (lead.clientId) { LC.crm.moveStage(lead.clientId, 'Lost', 'AI agent', 'Found another place'); LC.crm.update(lead.clientId, { lostReason: 'Found another place' }); }
    sysm('Closed: the occupier found another place. Client moved to Lost.'); say(T.closing); return done();
  }

  /* ---- handoff rules on intent (most serious first) ---- */
  const order = [['complaint', 'H3', 'Occupier is upset or complaining'], ['human', 'H4', 'Occupier asked to speak to a person'], ['legal', 'H2', 'Occupier asked about agreement or legal terms'], ['negotiate', 'H1', 'Occupier asked for a lower rent']];
  for (const [intent, rid, why] of order) {
    if (I[intent]) {
      if (ruleOn(rid)) { if (lead0.length) say(lead0.join('\n\n')); fireRule(lead, rid, why, parts); return done(); }
      lead0.push(T.off[rid]);                 // rule is switched off: answer politely and carry on
      break;
    }
  }

  /* ---- FAQ: answer without handing off ---- */
  const faqLines = () => {
    const idx = lead.matches.length ? parsePick(text, lead.matches.length, lead) : -1;
    parts.push(faqPart(lead, faq, unitFor(idx)));
  };

  if (e.stage === 'qualify') {
    if (answeredQ) {
      if (lead0.length) say(lead0.join('\n\n'));
      faqLines();
      if (e.expect) { say(T.q[e.expect]); e.awaiting = true; return done(); }
      return advance([]);
    }
    let acked = [];
    if (mp.got.length) { e.fails = 0; acked = mp.got; }
    else if (e.expect && !isFirst && !opts.ivr && !I.greeting) {
      e.fails++;
      if (e.fails === 1) { e.qCount++; say(T.qs[e.expect], { quick: QUICK[e.expect] }); e.awaiting = true; return done(); }
      e.fails = 0;
      if (ruleOn('H7')) { if (lead0.length) say(lead0.join('\n\n')); fireRule(lead, 'H7', 'Could not read the answer about "' + fieldLabel(e.expect).toLowerCase() + '" twice in a row', parts); return done(); }
      e.skipped[e.expect] = true; e.expect = null; offNote(lead, 'H7', parts);
    }
    const ackKeys = LC.REQ_FIELDS.map(f => f.key).filter(k => acked.includes(k));
    if (ackKeys.length) lead0.push(T.ack(ackKeys.map(k => valText(k, lead.req, lk)).join(', ')));
    return advance(lead0);
  }
  if (e.stage === 'pick') return pickStage();
  if (e.stage === 'slot') return slotStage();
  if (e.stage === 'booked') return bookedStage();
  return done();

  /* ---- next question, or the checks that come before matching ---- */
  function advance(prefix = []) {
    const req = lead.req;
    if (LC.reqIsQualified(req)) {
      if (lead.clientId && !e.agentSet) { e.agentSet = true; const c = LC.crm.get(lead.clientId); if (c && !['Rohit Mohanty'].includes(c.agent)) LC.crm.update(lead.clientId, { agent: LC.crm.assignAgent(req, lead.language) }); }
      if (!e.h5) {
        e.h5 = true;
        if (isLarge(req) && ruleOn('H5')) {
          if (prefix.length) say(prefix.join('\n\n'));
          const mid = LC.reqSizeMid(req), monthly = req.budgetMonthly || (req.budgetPsf || 0) * mid;
          fireRule(lead, 'H5', 'Large requirement: about ' + LC.fmtNum(Math.round(mid)) + ' sq ft, about ' + LC.fmtLakh(monthly) + ' a month all-in', parts);
          return done();
        }
      }
      if (!e.nurtured && req.moveIn && LC.daysBetween(LC.today(), req.moveIn) > 90) {
        e.nurtured = true; e.expect = null; e.awaiting = false; lead.status = 'nurture';
        if (lead.clientId) { LC.crm.moveStage(lead.clientId, 'Nurture', 'AI agent', 'Move-in is more than 90 days away'); LC.crm.update(lead.clientId, { nextFollowUp: +LC.parseDate(req.moveIn) - 60 * LC.DAY }); }
        sysm('Nurture: move-in is on ' + LC.fmtDate(req.moveIn) + ', more than 90 days away. Client moved to Nurture.');
        say([...prefix, T.nurture(LC.fmtDate(req.moveIn))].join('\n\n'));
        return done();
      }
    }
    const missing = LC.REQ_FIELDS.map(f => f.key).filter(k => !LC.reqHas(req, k) && !e.skipped[k]);
    if (missing.length && e.qCount < S.maxQuestions) {
      const k = missing[0]; e.expect = k; e.qCount++; e.awaiting = true;
      say([...prefix, T.q[k]].join('\n\n'));
      return done();
    }
    e.expect = null;
    if (LC.reqIsQualified(req)) return doMatch(prefix);
    if (prefix.length) say(prefix.join('\n\n'));
    if (!fireRule(lead, 'H7', 'Could not capture the requirement within ' + S.maxQuestions + ' questions', parts)) offNote(lead, 'H7', parts);
    return done();
  }

  function doMatch(prefix) {
    const res = LC.match(lead.req, { limit: 3 }), best = res.exact[0];
    if (!best || best.score < S.minMatchScore) {
      if (prefix.length) say(prefix.join('\n\n'));
      const why = best ? 'Best match scores ' + best.score + ', under the minimum of ' + S.minMatchScore : 'No unit passes the must-haves (' + res.closeCount + ' close misses)';
      sysm('Match run on ' + res.considered + ' units. ' + why + '.');
      if (!fireRule(lead, 'H6', why, parts)) {
        offNote(lead, 'H6', parts); lead.status = 'nurture'; e.awaiting = false;
        if (lead.clientId) LC.crm.moveStage(lead.clientId, 'Nurture', 'AI agent', 'No matching unit yet');
      }
      return done();
    }
    lead.matches = res.exact.map(r => r.u.unit_id);
    const fit = {}; res.exact.forEach(r => { fit[r.u.unit_id] = r.score; });
    if (lead.clientId) LC.crm.share(lead.clientId, lead.matches, 'AI agent');
    sysm('Match run on ' + res.considered + ' units: ' + res.exactCount + ' fit. Top ' + lead.matches.length + ' sent.');
    say([...prefix, T.shortIntro(lead.matches.length)].join('\n\n'), { cards: lead.matches, fit });
    say(T.pickPrompt(lead.matches.length), { quick: lead.matches.map((_, i) => String(i + 1)) });
    e.stage = 'pick'; e.expect = null; e.awaiting = true; e.pickFails = 0;
    return done();
  }

  function pickStage() {
    const n = lead.matches.length;
    if (answeredQ) { faqLines(); say(T.pickPrompt(n), { quick: lead.matches.map((_, i) => String(i + 1)) }); e.awaiting = true; return done(); }
    const idx = parsePick(text, n, lead);
    if (idx >= 0) return chooseUnit(idx);
    if (I.no || /none of|not these|neither|koi nahi|कोई नहीं|କିଛି ନୁହେଁ/i.test(text)) {
      if (!fireRule(lead, 'H6', 'Occupier did not like any of the ' + n + ' options sent', parts)) say(T.noneOfThese);
      return done();
    }
    if (looksQuestion(text)) { say(T.faq.unknown); say(T.pickPrompt(n), { quick: lead.matches.map((_, i) => String(i + 1)) }); e.awaiting = true; return done(); }
    e.pickFails++;
    if (e.pickFails >= 2 && fireRule(lead, 'H7', 'Could not tell which option the occupier chose, twice in a row', parts)) return done();
    say(T.pickAgain(n), { quick: lead.matches.map((_, i) => String(i + 1)) }); e.awaiting = true;
    return done();
  }

  function chooseUnit(idx) {
    const u = LC.unit(lead.matches[idx]); e.focus = u.unit_id;
    const slots = LC.visits.slots(u.unit_id).slice(0, 3);
    if (!slots.length) { fireRule(lead, 'H4', 'No free visit slots for ' + u.unit_id, parts); return done(); }
    e.slots = slots; e.stage = 'slot'; e.slotFails = 0; e.awaiting = true;
    say(T.slotOffer(unitLine(u)), { quick: slots.map(ts => LC.fmtDT(ts)) });
    return done();
  }

  function slotStage() {
    const u = LC.unit(e.focus);
    if (answeredQ) { faqLines(); say(T.slotAgain, { quick: e.slots.map(ts => LC.fmtDT(ts)) }); e.awaiting = true; return done(); }
    const idx = parseSlot(text, e.slots);
    if (idx < 0) {
      e.slotFails++;
      if (e.slotFails >= 2 && fireRule(lead, 'H7', 'Could not read the visit time twice in a row', parts)) return done();
      say(T.slotAgain, { quick: e.slots.map(ts => LC.fmtDT(ts)) }); e.awaiting = true; return done();
    }
    const when = e.slots[idx];
    const v = LC.visits.book({ clientId: lead.clientId, unitId: u.unit_id, when, by: 'AI agent', leadId: lead.id });
    lead.visitId = v.id; lead.status = 'booked'; e.stage = 'booked'; e.awaiting = false; e.expect = null;
    const h8 = ruleOn('H8');
    if (h8) lead.rulesFired.push('H8');
    else { const i = LC.state.tasks.findIndex(t => t.visitId === v.id); if (i >= 0) { LC.state.tasks.splice(i, 1); LC.emit('tasks:changed'); } }
    sysm('Visit booked: ' + unitLine(u) + ', ' + LC.fmtDT(when) + '. Status set to Visit booked.');
    if (h8) sysm(TXT.en.sysH8);
    say(T.booked(unitLine(u), LC.fmtDT(when), h8));
    return done();
  }

  function bookedStage() {
    if (answeredQ) { faqLines(); return done(); }
    if (/resched|change the time|postpone|cancel|another day|दूसरे दिन|समय बदल/i.test(text)) { if (!fireRule(lead, 'H4', 'Occupier wants to change the booked visit', parts)) say(T.off.H4); return done(); }
    if (I.yes || /thank|thanks|धन्यवाद|ଧନ୍ୟବାଦ|shukriya/i.test(text)) { say(T.thanks); return done(); }
    if (looksQuestion(text)) say(T.faq.unknown);
    return done();
  }
}

/* =====================================================================
   Occupier side: receiving a message, persona behaviour
   ===================================================================== */
function receive(lead, text, opts = {}) {
  const e = lead._e;
  addMsg(lead, 'lead', text, opts.ivr ? { ivr: true } : {});
  e.awaiting = false; e.nudges = 0;
  if (e.t0 == null) e.t0 = clock(lead);
  if (lead.status === 'human') return;
  if (lead.status === 'closed' && e.optOut && !/^start\b/i.test(text.trim())) return;
  lead._typing = true; touch(lead);
  later(lead, 1000 + rng() * 1000, () => {
    lead._typing = false;
    if (lead.status !== 'human') { try { aiRespond(lead, text, opts); } catch (err) { console.error('[inbox] agent error', err); } }
    touch(lead);
  });
}
function personaSend(lead, text) {
  later(lead, rint(2000, 8000), () => { if (!lead._p) return; receive(lead, text); });
}
function personaNext(lead) {
  const p = lead._p, e = lead._e; if (!p || p.quiet || lead._test) return;
  const send = (t) => personaSend(lead, t);
  const st = lead.status;
  if (st === 'closed') return;
  if (st === 'handoff' || st === 'human' || st === 'nurture' || st === 'booked') {
    if (!p.thanked && rchance(st === 'booked' ? .6 : .4)) { p.thanked = true; send(st === 'booked' ? p.lines.thanks : p.lines.okThanks); }
    return;
  }
  if (e.stage === 'qualify') {
    const k = e.expect; if (!k) return;
    if (p.kind === 'slow' && p.nAns >= p.slowAfter) { p.quiet = true; return; }
    if (p.nAns >= p.interruptAt) {
      if (p.kind === 'upset') { p.quiet = true; return send(p.lines.upset); }
      if (p.kind === 'human') { p.quiet = true; return send(p.lines.human); }
      if (p.kind === 'lost') { p.quiet = true; return send(p.lines.lost); }
    }
    if (p.kind === 'vague' && !p.vagueDone && k === p.vagueKey) { p.vagueDone = true; return send(p.vagueText); }
    if (p.kind === 'confusing' && p.confCount < 2) { const c = PL[p.lk].confuse; return send(c[p.confCount++ % c.length]); }
    p.nAns++; return send(p.say[k]);
  }
  if (e.stage === 'pick') {
    const n = lead.matches.length;
    if (p.kind === 'negotiator' && !p.negDone) { p.negDone = true; p.quiet = true; return send(p.lines.negotiate); }
    if (p.kind === 'legal' && !p.negDone) { p.negDone = true; p.quiet = true; return send(p.lines.legal); }
    if (p.faqWanted && !p.faqDone) { p.faqDone = true; return send(p.faqText); }
    let idx = lead.matches.indexOf(p.unit); if (idx < 0) idx = rint(0, n - 1);
    if (p.pickStyle === 'word') return send(PL[p.lk].words[idx]);
    const d = p.lk === 'od' && rchance(.25) ? ODIA_DIG[idx + 1] : p.lk === 'hi' && rchance(.25) ? HINDI_DIG[idx + 1] : String(idx + 1);
    return send(d);
  }
  if (e.stage === 'slot') {
    const last = [...lead.messages].reverse().find(m => m.from === 'ai' && m.quick);
    if (last) send(rpick(last.quick));
  }
}

/* =====================================================================
   Nudges, call list, team pick-up, hand-over controls
   ===================================================================== */
function nudgeScan() {
  for (const lead of LC.state.leads) {
    const e = lead._e;
    if (lead._test || !lead._p || lead.status !== 'ai' || !e.awaiting) continue;
    const h = (simNow - e.waitSince) / NUDGE_H_MS;
    if (e.nudges === 0 && h >= 24) sendNudge(lead, 1);
    else if (e.nudges === 1 && h >= 72) sendNudge(lead, 2);
    else if (e.nudges === 2 && h >= 96) callList(lead);
  }
}
function sendNudge(lead, n) {
  const e = lead._e, T = TXT[LK(lead)];
  e.nudges = n;
  addMsg(lead, 'system', 'Demo clock: ' + (n === 1 ? '24' : '72') + ' hours with no reply (compressed to about ' + (n === 1 ? '25' : '75') + ' seconds at 1x). Nudge ' + n + ' sent.');
  addMsg(lead, 'ai', n === 1 ? T.nudge1(greetName(lead)) : T.nudge2, { by: 'AI agent' });
  if (lead.clientId) LC.crm.addActivity(lead.clientId, 'message', 'Nudge ' + n + ' sent after ' + (n === 1 ? '24' : '72') + ' hours without a reply', 'AI agent');
}
function callList(lead) {
  const e = lead._e, c = lead.clientId ? LC.crm.get(lead.clientId) : null;
  e.nudges = 3; e.awaiting = false; lead.status = 'closed'; e.closedWhy = 'No reply, on the call list';
  LC.tasks.add({ type: 'Call list', title: 'Call ' + (lead.company || lead.name) + ': no reply after 2 nudges', due: Date.now() + 2 * 36e5, clientId: lead.clientId, leadId: lead.id, assignee: c ? c.agent : LC.crm.assignAgent(lead.req, lead.language), priority: 'Normal' });
  addMsg(lead, 'system', 'Demo clock: 96 hours with no reply. A call list task was created for ' + (c ? c.agent : 'the area agent') + '.');
  if (lead.clientId) LC.crm.addActivity(lead.clientId, 'message', 'No reply after two nudges. Added to the call list.', 'AI agent');
}
function waitedDeskMin(lead) { return lead.handoff ? deskMin(simNow - lead.handoff.simAt) : 0; }
function teamScan() {
  if (!teamWorks) return;
  for (const lead of LC.state.leads) if (lead.status === 'handoff' && lead._pickAt != null && !lead._test && simNow >= lead._pickAt) autoPickUp(lead);
}
function autoPickUp(lead) {
  const agent = lead.handoff.assignee, T = TXT[LK(lead)];
  pickUp(lead, agent, true);
  addMsg(lead, 'agent', T.pickedUp(agent), { by: agent });
  if (lead._p && !lead._p.thanked && rchance(.5)) { lead._p.thanked = true; later(lead, rint(2000, 6000), () => receive(lead, lead._p.lines.okThanks)); }
}
function pickUp(lead, by, auto) {
  const h = lead.handoff;
  if (h) { LC.queue.resolve(h.queueId, by); h.pickedAt = Date.now(); h.waited = waitedDeskMin(lead); h.by = by; }
  lead.status = 'human'; lead.humanBy = by; lead._e.awaiting = false; lead._typing = false; lead._pickAt = null;
  addMsg(lead, 'system', by + ' picked this up from the queue' + (h ? ' after ' + fmtMin(h.waited) + ' on the demo clock' : '') + '. The AI is paused on this chat.');
  if (lead.clientId) LC.crm.addActivity(lead.clientId, 'message', by + ' picked up the WhatsApp chat', by);
}
function takeOver(lead, by) {
  by = by || LC.state.me;
  if (lead.status === 'handoff') return pickUp(lead, by);
  lead.status = 'human'; lead.humanBy = by; lead._e.awaiting = false; lead._typing = false;
  addMsg(lead, 'system', by + ' took over this chat. The AI is paused.');
  if (lead.clientId) LC.crm.addActivity(lead.clientId, 'message', by + ' took over the WhatsApp chat', by);
}
function handBack(lead) {
  lead.status = lead.visitId ? 'booked' : 'ai'; lead.humanBy = null;
  if (lead._e.stage === 'new') lead._e.stage = 'qualify';
  addMsg(lead, 'system', 'Handed back to the AI agent.');
  lead._typing = true; touch(lead);
  later(lead, 1000 + rng() * 1000, () => { lead._typing = false; try { aiRespond(lead, '', { resume: true }); } catch (err) { console.error('[inbox] agent error', err); } touch(lead); });
}
function agentSend(lead, text) {
  text = String(text || '').trim(); if (!text) return;
  addMsg(lead, 'agent', text, { by: lead.humanBy || LC.state.me });
  lead._e.agentMsgs++;
  if (lead._p && lead._e.agentMsgs <= 3) later(lead, rint(2000, 6000), () => receive(lead, lead._p.lines.okThanks));
}

/* =====================================================================
   Simulator
   ===================================================================== */
function schedSim(ms, fn) { qInsert(simQ, { t: (evT != null ? evT : simNow) + ms, fn, lead: null }); }
const LK_OF_LANG = { English: 'en', Hindi: 'hi', Odia: 'od' };
const usedClients = new Set();
function pickOpenClient() {
  const pool = LC.state.clients.filter(c => !['Lost', 'Signed lease'].includes(c.stage) && c.phone && !usedClients.has(c.id) && !(c.leadId && leadById(c.leadId)));
  if (!pool.length) return null;
  const c = pool[Math.floor(rng() * pool.length)]; usedClients.add(c.id); return c;
}
function spawn(spec) {
  const ex = spec.kind === 'existing' ? pickOpenClient() : null;
  const kind = spec.kind === 'existing' ? 'coop' : spec.kind;
  const p = buildPersona(kind, { lk: ex ? (LK_OF_LANG[ex.language] || 'en') : spec.lk, source: spec.source, existing: ex });
  p.kind = ex ? 'existing' : spec.kind;
  const ivr = p.source === 'Phone call (IVR)';
  const lead = createLead({ name: ivr ? 'Caller ' + p.phone.replace(/\D/g, '').slice(-4) : p.name, company: ivr ? '' : p.company, phone: p.phone, source: p.source, language: p.lang, persona: p });
  receive(lead, p.first.text, { ivr });
  return lead;
}
function hasPending() {
  if (simQ.length) return true;
  for (const l of LC.state.leads) {
    if (l._test || !l._p) continue;
    if (l.status === 'ai' && l._e.awaiting) return true;
    if (l.status === 'handoff' && teamWorks && l._pickAt != null) return true;
  }
  return false;
}
const isLive = (l) => l.status === 'ai' || l.status === 'handoff' || l.status === 'human' || l.status === 'booked';
let peakLive = 0;
function computeStats() {
  const L = LC.state.leads, st = { total: L.length, live: 0, ai: 0, waiting: 0, breaches: 0, human: 0, booked: 0, nurture: 0, closed: 0, visits: 0, bySource: {}, rules: {}, byStatus: {}, queueTotal: LC.state.queue.length };
  const fr = [];
  for (const l of L) {
    if (isLive(l)) st.live++;
    st.byStatus[l.status] = (st.byStatus[l.status] || 0) + 1;
    if (l.status === 'ai') st.ai++; else if (l.status === 'handoff') { st.waiting++; if (slaState(l).over) st.breaches++; } else if (l.status === 'human') st.human++; else if (l.status === 'booked') st.booked++; else if (l.status === 'nurture') st.nurture++; else st.closed++;
    if (l.visitId) st.visits++;
    if (l.firstReplyMs != null) fr.push(l.firstReplyMs / 1000);
    st.bySource[l.source] = (st.bySource[l.source] || 0) + 1;
    l.rulesFired.forEach(r => { st.rules[r] = (st.rules[r] || 0) + 1; });
  }
  st.medianFirstReply = fr.length ? LC.median(fr) : null;
  if (st.live > peakLive) peakLive = st.live;
  st.peakLive = peakLive;
  return st;
}
/* SLA state of a lead waiting for a person, on the demo clock */
function slaState(lead) {
  const h = lead.handoff; if (!h || lead.status !== 'handoff') return { over: false, left: 0, waited: 0 };
  const waited = deskMin(simNow - h.simAt), left = LC.settings().slaMinutes - waited;
  return { over: left < 0, left, waited };
}
function slaLabel(lead) {
  const s = slaState(lead);
  return s.over ? { cls: 'sla-bad', text: Math.round(-s.left) + ' min over' } : { cls: s.left < 5 ? 'sla-warn' : 'sla-ok', text: Math.max(1, Math.round(s.left)) + ' min left' };
}

let tickTimer = null, lastTick = 0, lastEmit = 0;
function ensureTicker() { if (tickTimer) return; lastTick = performance.now(); tickTimer = setInterval(tick, 250); }
function tick() {
  if (isRemote()) return tickRemote();
  const now = performance.now(), dt = Math.min(now - lastTick, 1000); lastTick = now;
  if (!paused) simNow += dt * speed;
  if (active && !paused) {
    let guard = 0;
    while (simQ.length && simQ[0].t <= simNow && guard++ < 1000) { const ev = simQ.shift(); evT = ev.t; try { ev.fn(); } catch (err) { console.error('[inbox] sim event', err); } finally { evT = null; } }
    nudgeScan(); teamScan();
  }
  const rn = Date.now(); let g2 = 0;
  while (realQ.length && realQ[0].t <= rn && g2++ < 200) { const ev = realQ.shift(); evR = ev.t; try { ev.fn(); } catch (err) { console.error('[inbox] event', err); } finally { evR = null; } }
  for (const q of LC.queue.waiting()) if (q._simDue) q.slaDue = Date.now() + (q._simDue - simNow) / speed;
  if (active && !paused && !hasPending()) active = false;
  if (dirty.leads && now - lastEmit > 480) {
    lastEmit = now; const ids = Array.from(dirty.ids); dirty.ids.clear(); dirty.leads = false;
    LC.emit('leads:changed'); ids.forEach(id => LC.emit('lead:updated', id)); LC.emit('sim:tick');
  }
  if (active) computeStats();
  updatePill();
  if (typeof uiTick === 'function') uiTick(now);
}
/* REMOTE MODE: no queues here. The clock only keeps the waiting times and typing dots moving between server updates. */
function tickRemote() {
  const now = performance.now(), dt = Math.min(now - lastTick, 1000); lastTick = now;
  if (!LC.state) return;
  if (!paused) simNow += dt * speed;
  updatePill();
  if (typeof uiTick === 'function') uiTick(now);
}
/* REMOTE MODE: copy the server's simulator state (read only) */
function applySim(s) {
  if (!s || typeof s !== 'object') return;
  active = !!s.active; paused = !!s.paused; teamWorks = !!s.teamWorks;
  if ([1, 3, 6].includes(+s.speed)) speed = +s.speed;
  if (typeof s.simNow === 'number') simNow = s.simNow;
  if (ui.built && ui.el && ui.el.isConnected) {
    LC.$$('[data-sp]', ui.el).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sp === speed)));
    const tm = LC.$('#ib-team', ui.el); if (tm && tm.checked !== teamWorks) tm.checked = teamWorks;
  }
  updatePill();
}
let simFetching = false;
function fetchSim() {
  if (!isRemote() || simFetching || !LC.net || !LC.session || LC.session.role === 'owner') return;
  simFetching = true;
  LC.net.api('GET', '/api/sim/stats', undefined, { quiet401: true }).then(applySim).catch(() => { /* the live feed will bring it */ }).then(() => { simFetching = false; });
}
/* REMOTE MODE: one place for every action that goes to the server. Returns the answer, or null after showing why not. */
async function remote(path, body, opts) {
  opts = opts || {};
  try {
    const res = await LC.net.api('POST', path, body || {});
    if (res && res.sim) applySim(res.sim);
    if (res && res.lead) LC.net.ingest('leads', res.lead);
    return res || {};
  } catch (err) {
    if (!opts.quiet) LC.toast(err && err.message ? err.message : 'That did not work. Try again.');
    return null;
  } finally {
    if (!opts.noRefresh) { ui.headKey = ''; ui.compKey = ''; if (ui.built && LC.isActive('inbox') && ui.el && ui.el.isConnected) refreshAll(true); }
  }
}
function updatePill() {
  const pill = LC.$('#sim-pill'), t = LC.$('#sim-pill-t'); if (!pill || !t) return;
  const show = active || (paused && LC.state.leads.some(l => isRemote() ? l.channel === 'sim' : l._p));
  if (pill.hidden === show) pill.hidden = !show;
  if (show) {
    let n = 0; for (const l of LC.state.leads) if (isLive(l)) n++;
    const txt = (paused ? 'Simulator paused: ' : 'Simulator: ') + n + ' live';
    if (t.textContent !== txt) t.textContent = txt;
    pill.classList.toggle('good', !paused); pill.classList.toggle('warn', paused);
  }
}

const localSim = {
  start(n = 30) {
    ensureTicker(); active = true; paused = false;
    const deck = buildDeck(n); let gap = 100;
    deck.forEach(spec => { schedSim(gap, () => spawn(spec)); gap += rint(120, 380); });
    updatePill(); return n;
  },
  addOne(source) {
    ensureTicker(); active = true; paused = false;
    const spec = { kind: wpick(KIND_W), lk: wpick([['en', 60], ['od', 25], ['hi', 15]]), source: source || wpick(SRC_W) };
    schedSim(50, () => spawn(spec)); updatePill();
  },
  stop() { paused = true; updatePill(); },
  resume() { paused = false; if (!active && (simQ.length || hasPending())) active = true; updatePill(); },
  get running() { return active && !paused; },
  get paused() { return paused; },
  get speed() { return speed; },
  set speed(v) { speed = [1, 3, 6].includes(+v) ? +v : 1; },
  get teamWorks() { return teamWorks; },
  set teamWorks(v) { teamWorks = !!v; },
  stats: computeStats,
};
/* REMOTE MODE: the same surface, but each call goes to the server; the flags are mirrors of the server's state */
const remoteSim = {
  start(n = 30) { remote('/api/sim/start', { n }); return n; },
  addOne(source) { remote('/api/sim/add', source ? { source } : {}); },
  stop() { remote('/api/sim/stop'); },
  resume() { remote('/api/sim/resume'); },
  get running() { return active && !paused; },
  get paused() { return paused; },
  get speed() { return speed; },
  set speed(v) { v = [1, 3, 6].includes(+v) ? +v : 1; speed = v; remote('/api/sim/speed', { x: v }); },
  get teamWorks() { return teamWorks; },
  set teamWorks(v) { teamWorks = !!v; remote('/api/sim/team', { on: !!v }); },
  stats: computeStats,
};
LC.sim = {
  start: (n) => isRemote() ? remoteSim.start(n) : localSim.start(n),
  addOne: (src) => isRemote() ? remoteSim.addOne(src) : localSim.addOne(src),
  stop: () => isRemote() ? remoteSim.stop() : localSim.stop(),
  resume: () => isRemote() ? remoteSim.resume() : localSim.resume(),
  get running() { return (isRemote() ? remoteSim : localSim).running; },
  get paused() { return (isRemote() ? remoteSim : localSim).paused; },
  get speed() { return (isRemote() ? remoteSim : localSim).speed; },
  set speed(v) { (isRemote() ? remoteSim : localSim).speed = v; },
  get teamWorks() { return (isRemote() ? remoteSim : localSim).teamWorks; },
  set teamWorks(v) { (isRemote() ? remoteSim : localSim).teamWorks = v; },
  stats: computeStats,
};
LC.on('sim:remote', applySim);
LC.on('net:hello', fetchSim);
LC.on('state:ready', () => { if (isRemote()) { lastTick = performance.now(); ensureTicker(); fetchSim(); } });
LC.on('reset', () => {
  simQ.length = 0; realQ.length = 0; peakLive = 0; active = false; paused = false; simNow = 0; usedClients.clear(); dirty.ids.clear(); dirty.leads = false; rngState = 7001;
  if (LC.closeDrawer && typeof drawerLeadId !== 'undefined' && drawerLeadId) LC.closeDrawer();
  const pill = LC.$('#sim-pill'); if (pill) pill.hidden = true;
  if (typeof uiReset === 'function') uiReset();
});

/* SERVER HOOK (added for the Node runtime, no change in behaviour): the engine lives in this closure, so the server
   reaches it through LC._engine. Only function references are exported. In the browser nothing reads it. */
LC._engine = {
  createLead, receive, aiRespond, takeOver, handBack, agentSend, pickUp, leadById, addMsg, touch, ensureTicker,
  computeStats, slaState, demoPersona, buildPersona, LANG_OF, LK_OF_LANG, TXT, ruleOn,
  /* SERVER HOOK: the simulator's clock and switches, so the server can tell every browser (read only) */
  simState: () => ({ active, paused, speed, teamWorks, simNow }),
};

/* =====================================================================
   UI
   ===================================================================== */
LC.css(`
.ib { display: grid; gap: 16px; min-width: 0; }
.ib-strip { padding: 12px 14px; display: grid; gap: 10px; }
.ib-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.ib-kpi { background: var(--surface-2); border-radius: 8px; padding: 7px 12px; display: grid; gap: 0; min-width: 0; }
.ib-kpi .l { font-size: 11.5px; color: var(--muted); font-weight: 500; }
.ib-kpi .v { font-family: var(--f-head); font-size: 21px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.25; }
.ib-kpi .d { font-size: 11px; color: var(--muted); min-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-chips { display: flex; flex-wrap: nowrap; gap: 6px; align-items: center; overflow-x: auto; min-width: 0; padding-bottom: 2px; }
.ib-foot { display: flex; gap: 14px; align-items: center; min-width: 0; }
.ib-foot .ib-chips { flex: 1 1 auto; }
.ib-foot .ib-how { flex: none; }
.ib-foot .ib-how[open] { flex: 1 1 100%; }
.ib-foot:has(.ib-how[open]) { flex-wrap: wrap; }
.ib-sc { font-size: 11.5px; border: 1px solid var(--hair); background: var(--surface); border-radius: 999px; padding: 2px 9px; color: var(--fg-2); white-space: nowrap; }
.ib-sc b { font-family: var(--f-mono); font-weight: 600; margin-left: 4px; }
.ib-ctl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ib-ctl select.input { width: auto; padding: 5px 8px; font-size: 12.5px; }
.ib-ctl .seg button { padding: 5px 10px; }
.ib-add { display: inline-flex; gap: 6px; align-items: center; }
.ib-how summary { cursor: pointer; font-size: 12.5px; color: var(--brand-ink); font-weight: 500; }
.ib-how .defs { margin-top: 10px; }
.ib-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr) 310px; border: 1px solid var(--hair); border-radius: var(--r); background: var(--surface); overflow: hidden; height: clamp(540px, calc(100vh - 300px), 800px); box-shadow: var(--shadow); }
.ib-list, .ib-centre, .ib-detail { min-width: 0; min-height: 0; }
.ib-list { display: flex; flex-direction: column; border-right: 1px solid var(--hair); }
.ib-lh { padding: 10px 10px 8px; border-bottom: 1px solid var(--hair); display: grid; gap: 8px; }
.ib-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.ib-tabs button { border: 1px solid var(--hair); background: var(--surface); border-radius: 999px; padding: 3px 10px; font-size: 12px; display: inline-flex; gap: 6px; align-items: center; }
.ib-tabs button[aria-selected="true"] { background: var(--brand); color: var(--on-brand); border-color: var(--brand); }
.ib-rows { flex: 1; overflow-y: auto; min-height: 0; }
.ib-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--hair); background: transparent; padding: 9px 12px; }
.ib-row:hover { background: var(--surface-2); }
.ib-row[aria-current="true"] { background: var(--glow); }
.ib-av { width: 34px; height: 34px; border-radius: 50%; background: var(--surface-3); color: var(--fg-2); display: grid; place-items: center; font: 600 12px var(--f-head); flex: none; }
.ib-rb { min-width: 0; display: grid; gap: 1px; }
.ib-r1 { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.ib-r1 b { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-time { font-size: 11px; color: var(--muted); white-space: nowrap; }
.ib-r2, .ib-r3 { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.ib-r2 { color: var(--muted); } .ib-r3 { color: var(--fg-2); }
.ib-r4 { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: 3px; }
.ib-src, .ib-lang { font-size: 10.5px; border: 1px solid var(--hair); border-radius: 4px; padding: 0 5px; color: var(--muted); white-space: nowrap; }
.ib-row .pill { font-size: 10.5px; padding: 1px 7px; }
.ib-sla { font-size: 11px; font-family: var(--f-mono); }
.ib-centre { display: flex; flex-direction: column; background: var(--wa-bg); }
.ib-th { background: var(--surface); padding: 10px 14px; border-bottom: 1px solid var(--hair); display: grid; gap: 8px; }
.ib-th-top { display: flex; gap: 10px; align-items: center; min-width: 0; }
.ib-th-top .nm { min-width: 0; flex: 1; }
.ib-th-top .nm b { display: block; font-family: var(--f-head); font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-th-top .nm span { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.ib-back { display: none; border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-s); padding: 4px 9px; font-size: 12.5px; }
.ib-body { padding: 14px 18px; }
.ib-body > *, .ib-phone .wa-body > * { flex-shrink: 0; }
.ib-body .bub { max-width: min(560px, 86%); }
.ib-body .bub.sys { max-width: min(640px, 94%); }
.ib-wa { gap: 5px; }
.ib-wa i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
.ib-tick { margin-left: 4px; font-weight: 600; letter-spacing: -2px; white-space: nowrap; }
.ib-tick.read { color: var(--brand); }
.ib-tick.failed { color: var(--bad); letter-spacing: 0; }
.ib-tick.pending { opacity: .6; letter-spacing: 0; }
.ib-fail { display: block; text-align: right; font-size: 10.5px; color: var(--bad); margin-top: 1px; }
.ib-read { display: block; font-size: 10.5px; color: var(--wa-meta); font-style: italic; margin-top: 2px; }
.ib-by { display: block; font-size: 10.5px; font-weight: 600; color: var(--wa-meta); margin-bottom: 1px; }
.ib-body .wa-card, .ib-phone .wa-card { cursor: pointer; }
.ib-body .wa-card { width: min(340px, 84%); }
.ib-phone .wa-card { width: 88%; cursor: default; }
.ib-card.ib-r { align-self: flex-end; }
.ib-card .ph { height: 92px; padding: 0; overflow: hidden; background: var(--surface-3); }
.ib-card .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ib-card .cb .s { display: block; }
.ib-card .fit { color: var(--good); }
.ib-quick { display: flex; flex-wrap: wrap; gap: 6px; --qc: #0b8a5f; }
.ib-quick.r { align-self: flex-end; justify-content: flex-end; }
.ib-quick span, .ib-quick button { border: 1px solid var(--qc); color: var(--qc); background: var(--wa-in); border-radius: 16px; padding: 3px 10px; font-size: 12px; }
:root[data-theme="dark"] .ib-quick { --qc: #4fd1a5; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ib-quick { --qc: #4fd1a5; } }
.ib-body .typing.r { align-self: flex-end; }
.ib-empty { margin: auto; text-align: center; color: var(--muted); padding: 24px; max-width: 360px; }
.ib-comp { background: var(--surface); border-top: 1px solid var(--hair); padding: 8px 10px; display: flex; gap: 8px; align-items: center; }
.ib-comp input { flex: 1; min-width: 0; }
.ib-comp[hidden] { display: none; }
.ib-detail { border-left: 1px solid var(--hair); overflow-y: auto; padding: 12px 16px 18px; font-size: 12.5px; }
.ib-detail h3 { font: 600 11px var(--f-body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 16px 0 6px; }
.ib-detail h3:first-child { margin-top: 0; }
.ib-detail .cap { grid-template-columns: 96px minmax(0, 1fr) 16px; padding: 6px 0; }
.ib-ho { border: 1px solid var(--hair); border-left: 3px solid var(--warn); border-radius: 8px; padding: 9px 11px; background: var(--surface-2); display: grid; gap: 3px; }
.ib-ho.done { border-left-color: var(--good); }
.ib-ho.bad { border-left-color: var(--bad); }
.ib-unit { display: grid; gap: 1px; width: 100%; text-align: left; border: 1px solid var(--hair); background: var(--surface); border-radius: 6px; padding: 6px 9px; font-size: 12px; margin-bottom: 5px; }
.ib-unit:hover { border-color: var(--brand); }
.ib-unit b { font-weight: 600; }
.ib-rules { display: flex; flex-wrap: wrap; gap: 5px; }
.ib-queue-h .small { margin-left: auto; }
.ib-ph-wrap { display: grid; gap: 12px; }
.ib-phone { height: 560px; }
.ib-phone .wa-body { gap: 5px; }
.ib-phone .wa-quick { max-height: 120px; overflow-y: auto; }
.ib-sug { display: grid; gap: 8px; }
.ib-sug .chips .chip { font-size: 12px; }
.ib-setup { display: grid; gap: 12px; }
.ib-rules-tbl td, .ib-rules-tbl th { vertical-align: top; }
@media (max-width: 1280px) {
  .ib-grid { grid-template-columns: 330px minmax(0, 1fr); height: auto; }
  .ib-list, .ib-centre { height: clamp(520px, calc(100vh - 300px), 760px); }
  .ib-detail { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--hair); }
}
@media (max-width: 860px) {
  .ib-grid { grid-template-columns: minmax(0, 1fr); }
  .ib-grid[data-pane="list"] .ib-centre, .ib-grid[data-pane="list"] .ib-detail { display: none; }
  .ib-grid[data-pane="thread"] .ib-list { display: none; }
  .ib-back { display: inline-flex; }
  .ib-list, .ib-centre { height: clamp(480px, 72vh, 720px); }
  .ib-body { padding: 12px 10px; }
  .ib-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`);

const TABS = [
  { id: 'all', label: 'All', f: () => true },
  { id: 'mine', label: 'Assigned to me', exec: true, f: l => !!(l.handoff && l.handoff.assignee === LC.session.name && ['handoff', 'human', 'booked'].includes(l.status)) },
  { id: 'ai', label: 'AI handling', f: l => l.status === 'ai' },
  { id: 'needs', label: 'Needs a person', f: l => l.status === 'handoff' },
  { id: 'human', label: 'Person active', f: l => l.status === 'human' },
  { id: 'booked', label: 'Visit booked', f: l => l.status === 'booked' },
  { id: 'closed', label: 'Nurture and closed', f: l => l.status === 'nurture' || l.status === 'closed' },
];
const ui = { el: null, built: false, tab: 'all', sel: null, search: '', pane: 'list', lastList: 0, threadId: null, threadVer: -1, headKey: '', compKey: '', rowsHtml: '', detailHtml: '', queueHtml: '', stripKeys: {} };
let drawerLeadId = null, phoneVer = -1, phoneSugKey = '';
const photoCache = {};
const photoOf = (u) => photoCache[u.unit_id] || (photoCache[u.unit_id] = LC.photo(u));
const selLead = () => ui.sel ? leadById(ui.sel) : null;
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const shortAgo = (ts) => { const s = Math.round((Date.now() - ts) / 1000); return s < 45 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

/* a chat that runs over the real WhatsApp line (set by the server) */
const isWa = (l) => l.channel === 'whatsapp';
function waPill(l) {
  return isWa(l) ? '<span class="pill good ib-wa" title="This chat is on the real WhatsApp line. What you send here goes to the occupier\'s phone."><i></i>Live WhatsApp</span>' : '';
}
/* delivery marks on what we sent: sent one tick, delivered two, read two in the brand colour, failed in red */
function tickHTML(m) {
  if (!m.wa || m.from === 'lead') return '';
  const st = m.wa.status;
  if (st === 'failed') return '<span class="ib-tick failed" title="' + esc(m.wa.error || 'WhatsApp did not deliver this message') + '">!</span>';
  if (st === 'read') return '<span class="ib-tick read" title="Read">✓✓</span>';
  if (st === 'delivered') return '<span class="ib-tick" title="Delivered">✓✓</span>';
  if (st === 'sent') return '<span class="ib-tick" title="Sent">✓</span>';
  return '<span class="ib-tick pending" title="Sending">…</span>';
}
function failHTML(m) {
  return m.wa && m.wa.status === 'failed' ? '<span class="ib-fail" title="' + esc(m.wa.error || 'WhatsApp did not deliver this message') + '">Not delivered' + (m.wa.error ? ': ' + esc(String(m.wa.error).slice(0, 120)) : '') + '</span>' : '';
}
function statusPill(l) {
  if (l.status === 'ai') return '<span class="pill brand">AI handling</span>';
  if (l.status === 'handoff') return '<span class="pill ' + (slaState(l).over ? 'bad' : 'warn') + '">Needs a person</span>';
  if (l.status === 'human') return '<span class="pill good">Person active</span>';
  if (l.status === 'booked') return '<span class="pill good">Visit booked</span>';
  if (l.status === 'nurture') return '<span class="pill">Nurture</span>';
  const why = l._e.closedWhy || '';
  return '<span class="pill ' + (/another place|Opted/.test(why) ? 'bad' : '') + '" title="' + esc(why) + '">' + (/another place/.test(why) ? 'Lost' : /Opted/.test(why) ? 'Opted out' : /call list/.test(why) ? 'Call list' : 'Closed') + '</span>';
}
function previewOf(l) {
  for (let i = l.messages.length - 1; i >= 0; i--) {
    const m = l.messages[i]; if (m.from === 'system') continue;
    const who = m.from === 'ai' ? 'AI: ' : m.from === 'agent' ? first(m.by) + ': ' : '';
    return who + String(m.text).replace(/\s+/g, ' ').slice(0, 110);
  }
  return '';
}

/* ---------- skeleton ---------- */
function skeleton() {
  const kpi = (k, label, tip) => '<div class="ib-kpi" title="' + esc(tip) + '"><span class="l">' + label + '</span><span class="v" data-k="' + k + '">0</span><span class="d" data-k="' + k + '-d"></span></div>';
  return '<div class="ib">' +
    '<section class="card ib-strip" aria-label="Live counters and simulator controls">' +
      '<div class="ib-kpis">' +
        kpi('live', 'Live conversations', 'Chats that are still open: AI handling, needs a person, person active, or a visit booked (the AI keeps the chat open).') +
        kpi('ai', 'AI handling', 'Chats the AI agent is running by itself right now.') +
        kpi('waiting', 'Waiting for a person', 'Leads handed over by a rule and not yet picked up. Red means waiting longer than the SLA (15 minutes on the demo clock).') +
        kpi('visits', 'Visits booked', 'Site visits the AI agent booked in this session.') +
        kpi('reply', 'Median first reply', 'Median seconds from the occupier\'s first message to the AI agent\'s first reply, on the simulator clock.') +
        kpi('total', 'Leads this session', 'All leads created by the simulator or the occupier test chat since the last reset.') +
      '</div>' +
      '<div class="ib-ctl">' +
        '<button class="btn primary" type="button" data-a="sim30">Simulate 30 leads</button>' +
        '<span class="ib-add"><select class="input" id="ib-addsrc" aria-label="Source for the next lead"><option value="">Any source</option>' + LC.SOURCES.map(s => '<option>' + esc(s) + '</option>').join('') + '</select><button class="btn" type="button" data-a="add1">Add 1 lead</button></span>' +
        '<button class="btn" type="button" data-a="pause" id="ib-pause">Pause</button>' +
        '<span class="seg" role="group" aria-label="Simulator speed">' + [1, 3, 6].map(s => '<button type="button" data-sp="' + s + '" aria-pressed="' + (speed === s) + '">' + s + 'x</button>').join('') + '</span>' +
        '<label class="checkline" title="When on, simulated team members pick up waiting leads after a random time. Turn off to keep leads waiting."><input type="checkbox" id="ib-team"' + (teamWorks ? ' checked' : '') + '> Team works the queue (simulated)</label>' +
        '<button class="btn" type="button" data-a="test">Test as an occupier</button>' +
      '</div>' +
      '<div class="ib-foot">' + '<div class="ib-chips" id="ib-src" title="Leads by source, this session"></div>' +
      '<details class="ib-how"><summary>How the numbers and the demo clock work</summary>' +
        '<dl class="defs"><dt>Demo clock</dt><dd>Waiting times are compressed so you can see them. At 1x, 24 hours of silence is about 25 seconds, and the 15 minute SLA is about 90 seconds. At 3x and 6x it runs faster still.</dd>' +
        '<dt>First reply</dt><dd>The AI agent replies 1 to 2 seconds after each message, with a typing indicator. Occupiers reply after 2 to 8 seconds.</dd>' +
        '<dt>Handoff rules</dt><dd>The nine rules below decide when a person takes over. They are set in Settings and rules; switching one off makes the AI agent carry on by itself.</dd>' +
        '<dt>Language</dt><dd>The agent replies in English, Hindi or Odia, matching the occupier. Hindi and Odia lines are drafts for review by a native speaker.</dd></dl>' +
      '</details>' + '</div>' +
    '</section>' +
    '<section class="card" id="ib-queue" hidden><div class="card-h ib-queue-h"><h2>Handoff queue</h2><span class="small muted" id="ib-queue-n"></span></div><div class="tbl-wrap" id="ib-queue-t"></div></section>' +
    '<div class="ib-grid" id="ib-grid" data-pane="' + ui.pane + '">' +
      '<aside class="ib-list" aria-label="Conversations"><div class="ib-lh"><div class="ib-tabs" role="tablist" id="ib-tabs"></div><input class="input" id="ib-search" type="search" placeholder="Search name, company, phone or source" aria-label="Search conversations" value="' + esc(ui.search) + '"></div><div class="ib-rows" id="ib-rows"></div></aside>' +
      '<section class="ib-centre" aria-label="Conversation"><div class="ib-th" id="ib-th"></div><div class="wa-body ib-body" id="ib-body"></div><div class="ib-comp" id="ib-comp" hidden></div></section>' +
      '<aside class="ib-detail" id="ib-detail" aria-label="Lead details"></aside>' +
    '</div>' +
    '<section class="card"><div class="card-h"><h2>The nine handoff rules</h2><span class="small muted">Set in Settings and rules. Counts are for this session.</span></div><div class="tbl-wrap"><table class="tbl ib-rules-tbl"><thead><tr><th>Rule</th><th>Trigger</th><th>What happens</th><th>State</th><th class="r" title="Times this rule fired for leads in this session">Fired</th></tr></thead><tbody id="ib-rules"></tbody></table></div></section>' +
  '</div>';
}

function renderTabs(st) {
  const isExec = LC.session.role === 'executive', mine = isExec ? LC.state.leads.filter(l => l.handoff && l.handoff.assignee === LC.session.name && l.status === 'handoff').length : 0;
  const h = TABS.filter(t => !t.exec || isExec).map(t => '<button type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (ui.tab === t.id) + '">' + t.label + (t.id === 'needs' ? ' <span class="badge-n" id="ib-needs-n">' + st.waiting + '</span>' : '') + (t.id === 'mine' ? ' <span class="badge-n" title="Handoffs assigned to you that nobody has picked up yet">' + mine + '</span>' : '') + '</button>').join('');
  const box = LC.$('#ib-tabs', ui.el), sig = ui.tab + ':' + st.waiting + ':' + isExec + ':' + mine;
  if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.innerHTML = h; }
}

/* ---------- list ---------- */
function visibleLeads() {
  const tab = TABS.find(t => t.id === ui.tab) || TABS[0], q = ui.search.trim().toLowerCase();
  let L = LC.state.leads.filter(tab.f);
  if (q) L = L.filter(l => (l.name + ' ' + l.company + ' ' + l.phone + ' ' + l.source + ' ' + previewOf(l)).toLowerCase().includes(q));
  if (ui.tab === 'needs') L.sort((a, b) => (a.handoff ? a.handoff.simAt : 0) - (b.handoff ? b.handoff.simAt : 0));
  else L.sort((a, b) => b.createdAt - a.createdAt);
  return L;
}
function rowHTML(l) {
  let sla = '';
  if (l.status === 'handoff') { const s = slaLabel(l); sla = '<span class="ib-sla ' + s.cls + '" title="Time left to respond, on the demo clock">' + s.text + '</span>'; }
  return '<button type="button" class="ib-row" data-id="' + l.id + '" aria-current="' + (ui.sel === l.id) + '"><span class="ib-av">' + esc(initials(l.name)) + '</span><span class="ib-rb">' +
    '<span class="ib-r1"><b>' + esc(l.name) + '</b><span class="ib-time">' + shortAgo(l.lastAt) + '</span></span>' +
    '<span class="ib-r2">' + esc(l.company || l.phone) + '</span><span class="ib-r3">' + esc(previewOf(l)) + '</span>' +
    '<span class="ib-r4"><span class="ib-src">' + esc(l.source) + '</span><span class="ib-lang" title="' + esc(l.language) + '">' + LANG_TAG[l.language] + '</span>' + (l._test && !isWa(l) ? '<span class="ib-src">Test</span>' : '') + waPill(l) + statusPill(l) + sla + '</span></span></button>';
}
function renderList() {
  const L = visibleLeads(), cap = 150;
  const html = L.length ? L.slice(0, cap).map(rowHTML).join('') + (L.length > cap ? '<div class="empty small">Showing the newest ' + cap + ' of ' + L.length + '. Use search to find others.</div>' : '') : '<div class="empty">' + (LC.state.leads.length ? 'No conversations in this view.' : 'No leads yet. Press "Simulate 30 leads" or "Test as an occupier".') + '</div>';
  if (html !== ui.rowsHtml) { ui.rowsHtml = html; LC.$('#ib-rows', ui.el).innerHTML = html; }
}

/* ---------- strip, queue, rules ---------- */
function setText(k, v) { if (ui.stripKeys[k] !== v) { ui.stripKeys[k] = v; const n = LC.$('[data-k="' + k + '"]', ui.el); if (n) n.textContent = v; } }
function renderStrip(st) {
  setText('live', String(st.live)); setText('ai', String(st.ai)); setText('waiting', String(st.waiting));
  setText('visits', String(st.visits)); setText('total', String(st.total));
  setText('reply', st.medianFirstReply == null ? '–' : st.medianFirstReply.toFixed(1) + ' s');
  setText('live-d', st.human ? st.human + ' with a person' : ''); setText('ai-d', st.nurture + st.closed ? (st.nurture + st.closed) + ' nurture or closed' : '');
  setText('waiting-d', st.waiting ? (st.breaches ? st.breaches + ' over SLA' : 'all within SLA') : 'nobody waiting');
  const wd = LC.$('[data-k="waiting-d"]', ui.el); if (wd) wd.className = 'd' + (st.breaches ? ' sla-bad' : '');
  setText('visits-d', st.booked ? 'AI agent booked them' : ''); setText('reply-d', 'AI agent, simulator clock'); setText('total-d', '');
  const chips = Object.entries(st.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => '<span class="ib-sc">' + esc(s) + '<b>' + n + '</b></span>').join('');
  const box = LC.$('#ib-src', ui.el), h = chips || '<span class="small muted">Leads by source will show here.</span>';
  if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
  const pb = LC.$('#ib-pause', ui.el); const lbl = paused ? 'Resume' : 'Pause'; if (pb.textContent !== lbl) pb.textContent = lbl;
  pb.disabled = !(active || paused);
  renderTabs(st);
}
function renderQueue() {
  const card = LC.$('#ib-queue', ui.el), show = ui.tab === 'needs';
  card.hidden = !show; if (!show) return;
  const rows = LC.state.leads.filter(l => l.status === 'handoff').sort((a, b) => ((['H3', 'H5'].includes(b.handoff.rule) ? 1 : 0) - (['H3', 'H5'].includes(a.handoff.rule) ? 1 : 0)) || a.handoff.simAt - b.handoff.simAt);
  const html = rows.length ? '<table class="tbl"><thead><tr><th>Lead</th><th>Source</th><th>Rule</th><th>Reason</th><th>Assigned to</th><th title="Time since the handoff, on the demo clock">Waiting</th><th title="SLA is 15 minutes, on the demo clock">SLA</th><th></th></tr></thead><tbody>' +
    rows.map(l => { const s = slaState(l), lb = slaLabel(l), h = l.handoff;
      return '<tr><td><b>' + esc(l.name) + '</b><div class="small muted">' + esc(l.company || l.phone) + '</div></td><td>' + esc(l.source) + '</td><td><span class="pill ' + (h.priority === 'High' ? 'bad' : 'brand') + '" title="' + esc(ruleDef(h.rule).trigger) + '">' + h.rule + ' ' + esc(ruleDef(h.rule).name) + '</span></td><td>' + esc(h.reason) + '</td><td>' + esc(h.assignee) + '</td><td class="num">' + fmtMin(s.waited) + '</td><td class="' + lb.cls + '">' + lb.text + '</td><td style="white-space:nowrap"><button class="btn sm primary" type="button" data-pickup="' + l.id + '">Pick up</button> <button class="btn sm" type="button" data-open="' + l.id + '">Open</button></td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="empty">Nobody is waiting. The AI agent has every open chat in hand.</div>';
  if (html !== ui.queueHtml) { ui.queueHtml = html; LC.$('#ib-queue-t', ui.el).innerHTML = html; }
  const br = rows.filter(l => slaState(l).over).length;
  LC.$('#ib-queue-n', ui.el).textContent = rows.length + ' waiting' + (br ? ', ' + br + ' over SLA' : '') + '. Times are on the demo clock.';
}
function renderRules(st) {
  const tb = LC.$('#ib-rules', ui.el), rules = LC.settings().handoffRules;
  const sig = rules.map(r => r.id + r.on).join();
  if (tb.dataset.sig !== sig) {
    tb.dataset.sig = sig;
    tb.innerHTML = rules.map(r => '<tr><td><b>' + r.id + '</b> ' + esc(r.name) + '</td><td>' + esc(r.trigger) + '</td><td>' + esc(r.action) + '</td><td><span class="pill ' + (r.on ? 'good' : '') + '">' + (r.on ? 'On' : 'Off') + '</span></td><td class="r num" data-rc="' + r.id + '">0</td></tr>').join('');
  }
  LC.$$('[data-rc]', tb).forEach(td => { const v = String(st.rules[td.dataset.rc] || 0); if (td.textContent !== v) td.textContent = v; });
}

/* ---------- thread ---------- */
function cardHTML(unitId, fit, right) {
  const u = LC.unit(unitId); if (!u) return '';
  return '<div class="wa-card ib-card' + (right ? ' ib-r' : '') + '" data-unit="' + esc(u.unit_id) + '"' + (right ? ' role="button" tabindex="0" title="Open the full listing"' : '') + '><div class="ph"><img alt="" src="' + esc(photoOf(u)) + '"><em>' + esc(u.unit_id) + '</em></div><div class="cb"><b>' + esc(u.listing_title) + '</b>' +
    '<span class="s">₹' + u.all_in_per_sqft + '/sq ft all-in · ' + LC.fmtLakh(u.all_in_monthly) + ' a month</span>' +
    '<span class="s">' + LC.fmtNum(u.chargeable_sqft) + ' sq ft · ' + esc(u.furnishing) + ' · from ' + LC.fmtDate(u.available_from) + '</span>' +
    (fit ? '<span class="fit" title="Fit score from the match engine: budget 30, size 20, location 20, ready by move-in 15, specs 10, data freshness 5">' + fit + '% fit</span>' : '') + '</div></div>';
}
function threadHTML(l) {
  let lastQ = -1; for (let i = l.messages.length - 1; i >= 0; i--) { if (l.messages[i].from === 'lead') break; if (l.messages[i].quick) { lastQ = i; break; } }
  const human = l.status === 'human';
  let h = '';
  l.messages.forEach((m, i) => {
    if (m.from === 'system') { h += '<div class="bub sys">' + esc(m.text) + '</div>'; return; }
    const out = m.from !== 'lead';
    h += '<div class="bub ' + (out ? 'out' : 'in') + '">' + (m.from === 'ai' ? '<span class="ib-by">AI agent</span>' : m.from === 'agent' ? '<span class="ib-by">' + esc(m.by) + ' (person)</span>' : '') + linkify(m.text) + '<span class="t">' + LC.fmtTime(m.ts) + tickHTML(m) + '</span>' + failHTML(m) + (!out && m.read ? '<span class="ib-read" title="The reply was written from this reading of the message">AI read this as: ' + esc(m.read) + '</span>' : '') + '</div>';
    if (m.cards) h += m.cards.map(id => cardHTML(id, m.fit && m.fit[id], true)).join('');
    if (i === lastQ) h += '<div class="ib-quick r" title="Quick replies the occupier can tap">' + m.quick.map(q => human ? '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>' : '<span>' + esc(q) + '</span>').join('') + '</div>';
  });
  if (l._typing) h += '<div class="typing r" title="AI agent is typing"><i></i><i></i><i></i></div>';
  return h;
}
function headHTML(l) {
  const acts = [];
  if (l.status === 'handoff') acts.push('<button class="btn sm primary" type="button" data-act="pick">Pick up from queue</button>');
  else if (l.status === 'human') acts.push('<button class="btn sm primary" type="button" data-act="back">Hand back to AI</button>');
  else acts.push('<button class="btn sm" type="button" data-act="take" title="Pause the AI and type as a person">Take over</button>');
  if (l.clientId) acts.push('<button class="btn sm" type="button" data-act="client">Open client</button>');
  acts.push('<button class="btn sm" type="button" data-act="match" ' + (l.clientId ? '' : 'disabled') + '>Match</button>');
  acts.push('<button class="btn sm" type="button" data-act="visit" ' + (l.clientId && l.matches.length ? '' : 'disabled') + ' title="' + (l.matches.length ? 'Book a site visit' : 'Available once units have been sent') + '">Book visit</button>');
  return '<div class="ib-th-top"><button class="ib-back" type="button" data-act="list">‹ Inbox</button><span class="ib-av">' + esc(initials(l.name)) + '</span><div class="nm"><b>' + esc(l.name) + '</b><span>' + esc((l.company ? l.company + ' · ' : '') + l.phone) + '</span></div>' + waPill(l) + statusPill(l) + '</div>' +
    '<div class="ib-acts"><span class="ib-src">' + esc(l.source) + '</span><span class="ib-lang" title="' + esc(l.language) + '">' + LANG_TAG[l.language] + '</span>' + acts.join('') + '</div>';
}
function renderThread(l, force) {
  const th = LC.$('#ib-th', ui.el), body = LC.$('#ib-body', ui.el), comp = LC.$('#ib-comp', ui.el);
  if (!l) {
    th.innerHTML = '<div class="small muted">Select a conversation</div>'; body.innerHTML = '<div class="ib-empty"><b>No conversation open</b><p class="small">Pick one from the list. Each chat shows what the occupier sees, the AI agent\'s replies and the rules that fired.</p></div>';
    comp.hidden = true; ui.threadId = null; ui.threadVer = -1; ui.headKey = ''; return;
  }
  const hk = l.id + '|' + l.status + '|' + !!l.clientId + '|' + l.matches.length + '|' + l.humanBy + '|' + l.name + '|' + (l.channel || '');
  if (hk !== ui.headKey) { ui.headKey = hk; th.innerHTML = headHTML(l); }
  const ck = l.id + (l.status === 'human');
  if (ck !== ui.compKey) {
    ui.compKey = ck; comp.hidden = l.status !== 'human';
    comp.innerHTML = l.status === 'human' ? '<input class="input" id="ib-msg" placeholder="Type as ' + esc(l.humanBy || LC.state.me) + ' (a person)" aria-label="Message"><button class="btn primary" type="button" data-act="send">Send</button>' : '';
  }
  const changedLead = ui.threadId !== l.id;
  const near = body.scrollHeight - body.scrollTop - body.clientHeight < 90;
  body.innerHTML = threadHTML(l) || '<div class="ib-empty small">No messages yet.</div>';
  if (changedLead || near || force) body.scrollTop = body.scrollHeight;
  ui.threadId = l.id; ui.threadVer = l._ver;
}

/* ---------- detail ---------- */
function detailHTML(l) {
  if (!l) return '<div class="muted small">Details for the open conversation show here: what the agent captured, the handoff, the units sent and the rules that fired.</div>';
  const lk = 'en';
  let h = '<h3>What the agent captured</h3><div class="captured">' + LC.REQ_FIELDS.map(f => {
    const has = LC.reqHas(l.req, f.key), skipped = l._e.skipped[f.key];
    return '<div class="cap"><span>' + esc(f.label) + '</span><b>' + (has ? esc(valText(f.key, l.req, lk)) : '<em class="muted" style="font-weight:400">' + (skipped ? 'skipped' : 'not yet') + '</em>') + '</b>' + (has ? '<i class="ok" style="font-style:normal">✓</i>' : '<i></i>') + '</div>';
  }).join('') + '</div><div class="small muted" style="margin-top:6px" title="The agent asks at most ' + LC.settings().maxQuestions + ' questions per lead">Questions asked: ' + l._e.qCount + ' of ' + LC.settings().maxQuestions + ' allowed</div>';
  if (l.handoff) {
    const hd = l.handoff, r = ruleDef(hd.rule), s = slaState(l);
    let cls = '', line = '';
    if (l.status === 'handoff') { const lb = slaLabel(l); cls = s.over ? ' bad' : ''; line = 'Waiting ' + fmtMin(s.waited) + ' of ' + LC.settings().slaMinutes + ' allowed. <b class="' + lb.cls + '">' + lb.text + '</b>'; }
    else { cls = ' done'; line = hd.by ? 'Picked up by ' + esc(hd.by) + (hd.waited != null ? ' after ' + fmtMin(hd.waited) : '') : 'Resolved'; }
    h += '<h3>Handoff</h3><div class="ib-ho' + cls + '"><div><b>' + hd.rule + ' ' + esc(r.name) + '</b></div><div>' + esc(hd.reason) + '</div><div class="muted">Assigned to ' + esc(hd.assignee) + (hd.priority === 'High' ? ' · priority' : '') + '</div><div>' + line + '</div></div>';
  }
  if (l.visitId) {
    const v = LC.visits.get(l.visitId), u = v && LC.unit(v.unitId);
    if (v) h += '<h3>Visit</h3><div class="ib-ho done"><div><b>' + esc(u ? unitLine(u) : v.unitId) + '</b></div><div>' + LC.fmtDT(v.when) + ' · booked by ' + esc(v.by) + '</div><div class="muted">Confirmation call to ' + esc(v.agent) + ' the day before (rule H8)</div></div>';
  }
  if (l.matches.length) h += '<h3>Units sent</h3>' + l.matches.map(id => { const u = LC.unit(id); return u ? '<button type="button" class="ib-unit" data-unit="' + esc(id) + '"><b>' + esc(unitLine(u)) + '</b><span class="muted">' + esc(u.locality) + ' · ₹' + u.all_in_per_sqft + '/sq ft all-in · ' + LC.fmtNum(u.chargeable_sqft) + ' sq ft</span></button>' : ''; }).join('');
  h += '<h3>Rules fired</h3>' + (l.rulesFired.length ? '<div class="ib-rules">' + Array.from(new Set(l.rulesFired)).map(id => '<span class="pill brand" title="' + esc(ruleDef(id).trigger) + '">' + id + ' ' + esc(ruleDef(id).name) + '</span>').join('') + '</div>' : '<div class="muted">None yet. The AI agent is handling this one.</div>');
  h += '<h3>Contact</h3><div class="kv" style="grid-template-columns:1fr"><div><span>Source</span><b>' + esc(l.source) + '</b></div>' + (isWa(l) ? '<div><span>Channel</span><b>Live WhatsApp</b></div>' : '') + '<div><span>Language</span><b>' + esc(l.language) + '</b></div><div><span>Phone</span><b class="num">' + esc(l.phone) + '</b></div><div><span>First reply</span><b>' + (l.firstReplyMs != null ? (l.firstReplyMs / 1000).toFixed(1) + ' s' : 'not yet') + '</b></div>' + (l.existing ? '<div><span>Note</span><b>Existing client, no new record</b></div>' : '') + '</div>';
  return h;
}
function renderDetail(l) {
  const html = detailHTML(l);
  if (html !== ui.detailHtml) { ui.detailHtml = html; LC.$('#ib-detail', ui.el).innerHTML = html; }
}

/* ---------- refresh, tick ---------- */
function refreshAll(force) {
  if (!ui.sel && LC.state.leads.length && window.innerWidth > 860) { const v = visibleLeads()[0] || LC.state.leads[LC.state.leads.length - 1]; if (v) ui.sel = v.id; }
  const st = computeStats(); const l = selLead();
  renderStrip(st); renderList(); renderQueue(); renderRules(st);
  renderThread(l, force); renderDetail(l);
  LC.$('#ib-grid', ui.el).dataset.pane = ui.pane;
  ui.lastList = performance.now();
}
function uiTick(now) {
  if (drawerLeadId) phoneTick();
  if (!ui.built || !LC.isActive('inbox') || !ui.el || !ui.el.isConnected) return;
  if (!ui.sel && LC.state.leads.length && window.innerWidth > 860) { const v = visibleLeads()[0]; if (v) { ui.sel = v.id; ui.rowsHtml = ''; } }
  const l = selLead();
  if (l && (l._ver !== ui.threadVer || l.id !== ui.threadId)) renderThread(l);
  else if (!l && ui.threadId) renderThread(null);
  if (now - ui.lastList >= 500) {
    ui.lastList = now; const st = computeStats();
    renderStrip(st); renderList(); renderQueue(); renderRules(st); renderDetail(selLead());
    const b = LC.$('#ib-grid', ui.el); if (b && b.dataset.pane !== ui.pane) b.dataset.pane = ui.pane;
  }
}
function uiReset() { ui.sel = null; ui.rowsHtml = ''; ui.detailHtml = ''; ui.queueHtml = ''; ui.threadId = null; ui.threadVer = -1; ui.headKey = ''; ui.compKey = ''; ui.pane = 'list'; ui.stripKeys = {}; phoneVer = -1; }

function select(id, pane) {
  ui.sel = id; ui.pane = pane || 'thread'; ui.rowsHtml = '';
  const l = selLead(); renderThread(l, true); renderDetail(l); renderList();
  LC.$('#ib-grid', ui.el).dataset.pane = ui.pane;
}
function bind(el) {
  el.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, [data-unit], tr, a'); if (!t || !el.contains(t)) return;
    if (t.tagName === 'A') return;
    const d = t.dataset;
    if (d.a) {
      if (d.a === 'sim30') { LC.sim.start(30); LC.toast('Simulating 30 leads from many sources'); }
      else if (d.a === 'add1') { LC.sim.addOne(LC.$('#ib-addsrc', el).value || null); }
      else if (d.a === 'pause') { if (paused) LC.sim.resume(); else LC.sim.stop(); }
      else if (d.a === 'test') openTestDrawer();
      refreshAll(); return;
    }
    if (d.sp) { LC.sim.speed = +d.sp; LC.$$('[data-sp]', el).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sp === speed))); return; }
    if (d.tab) { ui.tab = d.tab; ui.rowsHtml = ''; ui.queueHtml = ''; ui.pane = 'list'; refreshAll(); return; }
    if (d.pickup) {
      const l = leadById(d.pickup);
      if (l && isRemote()) { remote('/api/leads/' + encodeURIComponent(l.id) + '/pickup').then((r) => { if (r) { ui.tab = 'human'; select(l.id); refreshAll(true); } }); return; }
      if (l) { pickUp(l, LC.state.me); ui.tab = 'human'; select(l.id); refreshAll(true); }
      return;
    }
    if (d.open) { select(d.open); return; }
    if (d.q) { const inp = LC.$('#ib-msg', el); if (inp) { inp.value = d.q; inp.focus(); } return; }
    if (d.unit) { LC.openUnit && LC.openUnit(d.unit); return; }
    if (d.id) { select(d.id); return; }
    if (d.act) {
      const l = selLead();
      if (d.act === 'list') { ui.pane = 'list'; LC.$('#ib-grid', el).dataset.pane = 'list'; return; }
      if (!l) return;
      if (isRemote() && ['pick', 'take', 'back', 'send'].includes(d.act)) {
        const base = '/api/leads/' + encodeURIComponent(l.id) + '/';
        if (d.act === 'send') { const inp = LC.$('#ib-msg', el), text = inp ? inp.value.trim() : ''; if (!text) return; inp.value = ''; remote(base + 'send', { text }).then((r) => { if (!r && inp.isConnected && !inp.value) inp.value = text; }); return; }
        const wasQueue = d.act === 'pick';
        remote(base + (d.act === 'pick' ? 'pickup' : d.act === 'take' ? 'takeover' : 'handback')).then((r) => { if (r && wasQueue && ui.tab === 'needs') { ui.tab = 'human'; ui.rowsHtml = ''; ui.queueHtml = ''; } });
        return;
      }
      if (d.act === 'pick') { pickUp(l, LC.state.me); ui.tab = ui.tab === 'needs' ? 'human' : ui.tab; }
      else if (d.act === 'take') takeOver(l);
      else if (d.act === 'back') handBack(l);
      else if (d.act === 'client') { LC.openClient && LC.openClient(l.clientId); return; }
      else if (d.act === 'match') { LC.go('match', { clientId: l.clientId }); return; }
      else if (d.act === 'visit') { LC.openBookVisit && LC.openBookVisit({ clientId: l.clientId, unitId: e0(l) }); return; }
      else if (d.act === 'send') { const inp = LC.$('#ib-msg', el); agentSend(l, inp.value); inp.value = ''; }
      ui.headKey = ''; ui.compKey = ''; refreshAll(true);
    }
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'ib-msg') {
      ev.preventDefault(); const l = selLead(); if (!l) return;
      if (isRemote()) {
        const inp = ev.target, text = inp.value.trim(); if (!text) return; inp.value = '';
        remote('/api/leads/' + encodeURIComponent(l.id) + '/send', { text }).then((r) => { if (!r && inp.isConnected && !inp.value) inp.value = text; else if (r) renderThread(selLead(), true); });
        return;
      }
      agentSend(l, ev.target.value); ev.target.value = ''; renderThread(l, true);
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('.wa-card[data-unit]')) { ev.preventDefault(); LC.openUnit && LC.openUnit(ev.target.dataset.unit); }
  });
  el.addEventListener('input', (ev) => { if (ev.target.id === 'ib-search') { ui.search = ev.target.value; ui.rowsHtml = ''; renderList(); } });
  el.addEventListener('change', (ev) => { if (ev.target.id === 'ib-team') LC.sim.teamWorks = ev.target.checked; });
}
const e0 = (l) => l._e.focus || l.matches[0];

LC.registerView('inbox', {
  title: 'Lead inbox', sub: 'Every enquiry answered in under a minute. People take over by rule.',
  render(el, param) {
    ensureTicker();
    if (isRemote()) fetchSim();
    if (param && param.leadId && leadById(param.leadId)) { ui.sel = param.leadId; ui.pane = 'thread'; ui.tab = 'all'; }
    if (param && param.tab && TABS.some(t => t.id === param.tab)) { ui.tab = param.tab; ui.pane = 'list'; }
    if (ui.tab === 'mine' && LC.session.role !== 'executive') ui.tab = 'all';
    if (ui.sel && !selLead()) { ui.sel = null; ui.pane = 'list'; }
    ui.el = el; ui.built = false; ui.rowsHtml = ''; ui.detailHtml = ''; ui.queueHtml = ''; ui.threadId = null; ui.threadVer = -1; ui.headKey = ''; ui.compKey = ''; ui.stripKeys = {};
    el.innerHTML = skeleton();
    if (!el._ibBound) { bind(el); el._ibBound = true; }
    ui.built = true;
    refreshAll(true);
  },
  onHide() { /* the simulator keeps running; the ticker skips the screen while it is hidden */ },
});
LC.openLead = (id) => { ui.sel = id; ui.pane = 'thread'; ui.tab = 'all'; LC.go('inbox', { leadId: id }); };

/* =====================================================================
   Test as an occupier: a phone you can chat on, talking to the real agent
   ===================================================================== */
function demoPersona(lk, source) {
  const keep = rngState; let p;
  try { p = buildPersona('coop', { lk, source, existing: null }); } finally { rngState = keep; }
  return p;
}
function openTestDrawer() {
  let lk = 'en', source = '99acres', demo = demoPersona(lk, source);
  const html = '<div class="ib-setup"><p class="lede">Play the occupier. Choose where the enquiry comes from and which language to use. The agent answers exactly as it would on WhatsApp, and a real lead appears in the inbox.</p>' +
    '<div class="grid-2"><div class="field"><label for="tp-src">Source</label><select class="input" id="tp-src">' + LC.SOURCES.map(s => '<option' + (s === source ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="tp-lang">Language</label><select class="input" id="tp-lang"><option>English</option><option>Hindi</option><option>Odia</option></select></div></div>' +
    '<div class="field"><label for="tp-first">First message the agent receives</label><textarea class="input" id="tp-first"></textarea><div class="small muted" id="tp-hint"></div></div>' +
    '<div><button class="btn primary" type="button" id="tp-start">Start chat</button></div></div>';
  const dr = LC.drawer({ title: 'Test as an occupier', sub: 'The phone shows what the occupier sees.', html, onClose: () => { drawerLeadId = null; } });
  const scrim = LC.$('#drawer-root .scrim'); if (scrim) scrim.style.cssText = 'background:transparent;pointer-events:none';
  const root = dr.el, ta = LC.$('#tp-first', root), hint = LC.$('#tp-hint', root);
  const fill = () => {
    source = LC.$('#tp-src', root).value; lk = { English: 'en', Hindi: 'hi', Odia: 'od' }[LC.$('#tp-lang', root).value]; demo = demoPersona(lk, source);
    ta.value = demo.first.text; ta.readOnly = !!demo.first.ivr;
    hint.textContent = demo.first.ivr ? 'The phone system sends this missed-call notice. The agent then starts the WhatsApp chat.' : /^\[|form:|^Walk-in|^Website/.test(demo.first.text) ? 'Portals, ad forms and the front desk send a structured enquiry like this. You can edit it.' : 'Free text from WhatsApp, the website or a referral. You can edit it.';
  };
  LC.$('#tp-src', root).addEventListener('change', fill); LC.$('#tp-lang', root).addEventListener('change', fill); fill();
  LC.$('#tp-start', root).addEventListener('click', () => {
    const ivr = !!demo.first.ivr, text = ta.value.trim() || demo.first.text;
    if (isRemote()) {
      const btn = LC.$('#tp-start', root); btn.disabled = true;
      const lang = LC.$('#tp-lang', root).value;
      remote('/api/test-chat', { text, source, language: lang, name: ivr ? undefined : demo.name, company: ivr ? undefined : demo.company, ivr }, { noRefresh: true }).then((r) => {
        if (!r || !r.leadId) { btn.disabled = false; return; }
        remoteDemo[r.leadId] = demo; drawerLeadId = r.leadId;
        if (r.lead) LC.net.ingest('leads', r.lead);
        const lead = leadById(r.leadId);
        mountPhone(root, lead || { id: r.leadId });
        if (LC.isActive('inbox') && ui.built) { ui.tab = 'all'; select(r.leadId, ui.pane); refreshAll(true); }
      });
      return;
    }
    const lead = createLead({ name: ivr ? 'Caller ' + demo.phone.replace(/\D/g, '').slice(-4) : demo.name, company: ivr ? '' : demo.company, phone: demo.phone, source, language: LANG_OF[lk], test: true });
    lead._demo = demo; drawerLeadId = lead.id; ensureTicker();
    receive(lead, text, { ivr });
    mountPhone(root, lead);
    if (LC.isActive('inbox') && ui.built) { ui.tab = 'all'; select(lead.id, ui.pane); refreshAll(true); }
  });
}
let phoneRoot = null;
const remoteDemo = {};          // REMOTE MODE: the presenter's suggested answers per test chat (they stay in this browser)
function mountPhone(root, lead) {
  phoneRoot = root; phoneVer = -1; phoneSugKey = '';
  root.innerHTML = '<div class="ib-ph-wrap"><div class="phone ib-phone"><div class="wa-head"><div class="wa-av">L</div><div><b>Leasify Commercial</b><span>Business account</span></div></div><div class="wa-body" id="ph-body"></div><div class="wa-quick" id="ph-quick" hidden></div>' +
    '<form class="wa-input" id="ph-form"><input id="ph-in" placeholder="Type a message" autocomplete="off" aria-label="Message"><button type="submit" aria-label="Send">➤</button></form></div>' +
    '<div class="ib-sug" id="ph-sug"></div><p class="note">The lead is real: it shows in the inbox, creates a client in the CRM and follows every handoff rule. Replies take 1 to 2 seconds.</p></div>';
  const send = (t) => {
    t = String(t || '').trim(); if (!t) return;
    if (isRemote()) { remote('/api/test-chat', { text: t, leadId: lead.id }, { noRefresh: true }).then((r) => { if (r) { phoneVer = -1; phoneTick(); } }); return; }
    receive(lead, t); phoneVer = -1; phoneTick();
  };
  LC.$('#ph-form', root).addEventListener('submit', (ev) => { ev.preventDefault(); const i = LC.$('#ph-in', root); send(i.value); i.value = ''; });
  root.addEventListener('click', (ev) => { const b = ev.target.closest('[data-pq]'); if (b) send(b.dataset.pq); });
  phoneTick();
}
function phoneTick() {
  const root = phoneRoot; if (!root || !root.isConnected) { drawerLeadId = null; return; }
  const l = leadById(drawerLeadId); if (!l) return;
  const sugKey = l._e.stage + '|' + l._e.expect + '|' + l.status + '|' + l.matches.length;
  if (l._ver === phoneVer && sugKey === phoneSugKey) return;
  phoneVer = l._ver; phoneSugKey = sugKey;
  const body = LC.$('#ph-body', root), near = body.scrollHeight - body.scrollTop - body.clientHeight < 90;
  let h = '', lastLead = -1, lastQ = -1;
  l.messages.forEach((m, i) => { if (m.from === 'lead') lastLead = i; if (m.from === 'ai' && m.quick) lastQ = i; });
  l.messages.forEach((m) => {
    if (m.from === 'system') return;
    if (m.ivr) { h += '<div class="bub sys">' + esc(m.text) + '</div>'; return; }
    const t = '<span class="t">' + LC.fmtTime(m.ts) + '</span>';
    if (m.from === 'lead') h += '<div class="bub out">' + linkify(m.text) + t + '</div>';
    else { h += '<div class="bub in">' + (m.from === 'agent' ? '<span class="ib-by">' + esc(m.by) + '</span>' : '') + linkify(m.text) + t + '</div>'; if (m.cards) h += m.cards.map(id => cardHTML(id, m.fit && m.fit[id], false)).join(''); }
  });
  if (l._typing) h += '<div class="typing" title="Typing"><i></i><i></i><i></i></div>';
  body.innerHTML = h; if (near || !body.dataset.init) { body.scrollTop = body.scrollHeight; body.dataset.init = '1'; }
  const qb = LC.$('#ph-quick', root), q = lastQ > lastLead ? l.messages[lastQ].quick : null;
  qb.hidden = !q; qb.innerHTML = q ? q.map(x => '<button type="button" data-pq="' + esc(x) + '">' + esc(x) + '</button>').join('') : '';
  // suggestions for the presenter
  const d = l._demo || remoteDemo[l.id], lk = LK(l), L = PL[lk], e = l._e, ans = [];
  if (d && e.stage === 'qualify' && e.expect && d.say[e.expect]) ans.push(d.say[e.expect]);
  if (e.stage === 'pick') { l.matches.forEach((_, i) => ans.push(String(i + 1))); if (d) ans.push(d.faqText); }
  if (e.stage === 'booked') ans.push(L.thanks[0]);
  const rules = [['Ask for a discount (H1)', L.negotiate[0]], ['Ask about stamp duty (H2)', L.legal[0]], ['Complain (H3)', L.upset[0]], ['Ask for a call (H4)', L.human[0]], ['Say you found another place', L.lost[0]]];
  LC.$('#ph-sug', root).innerHTML = (ans.length ? '<div class="eyebrow">Suggested answer</div><div class="chips">' + ans.map(a => '<button type="button" class="chip" data-pq="' + esc(a) + '">' + esc(a) + '</button>').join('') + '</div>' : '') +
    '<div class="eyebrow">Try a rule</div><div class="chips">' + rules.map(r => '<button type="button" class="chip" data-pq="' + esc(r[1]) + '" title="' + esc(r[1]) + '">' + esc(r[0]) + '</button>').join('') + '</div>';
}
})();
