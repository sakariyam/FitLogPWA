// Class content. Each class carries its own gear, quests and look art.
// Classic script: shares globals with the other files in js/ (load order is in popup.html).

/* ---------- Classes. Every class carries its own gear and quests. ---------- */
const E = (name, sprite, hp) => ({ name, sprite, hp });    // strength enemy
const L = (name, sprite, km) => ({ name, sprite, km });    // agility leg
const CLASSES = {
  salaryman: {
    name: 'Salaryman',
    blurb: 'Suit, tie and a trusty briefcase. Fights the daily grind.',
    enabled: true,
    gear: {
      materials: ['Budget', 'Casual', 'Office', 'Business', 'Designer'],
      pieces: {
        weapon: [{name: 'Notepad' , look: 'notepad'},{ name: 'Briefcase', look: 'briefcase' }, { name: 'Keyboard', look: 'keyboard' }],
        head: [{ name: 'Fedora', look: 'fedora' }, { name: 'Glasses', look: 'glasses' }],
        body: [{ name: 'Suit Jacket', look: 'jacket' }, { name: 'Blazer', look: 'blazer' }],
        neck: [{ name: 'Tie', look: 'tie' }, { name: 'Bow Tie', look: 'bowtie' }],
        feet: [{ name: 'Loafers', look: 'loafers' }, { name: 'Oxfords', look: 'oxfords' }]
      },
      suffix: { strength: ' of Grit', agility: ' of Haste' }
    },
    itemSprites: SALARYMAN_ITEMS,
    headshot: SALARYMAN_HEADSHOT,
    looks: SALARYMAN_LOOKS,
    chapter: 'Chapter 1: Clocking In',
    quests: {
      strength: [
        { 
          id: 's1', 
          name: 'Morning Commute', 
          req: 1, 
          rewardXp: 150, 
          minRarity: 1, 
          encounters: [E('Stray Dog', 'dog', 30)], 
          boss: E('Cursed Bike', 'bike', 40) },
        { 
          id: 's2', 
          name: 'Lunch: Office Cafeteria', 
          req: 3, rewardXp: 200, 
          minRarity: 1,
          encounters: [E('Slightly Too Warm Fridge', 'suit', 30)], 
          boss: E('Malfunctioning Microwave', 'machine', 45) },
        { 
          id: 's3', 
          name: 'Open Plan Office', 
          req: 5, rewardXp: 300, minRarity: 2,
          encounters: [E('Loud Coworker', 'suit', 30), E('Glitching Computer', 'machine', 35), E('Phishing E-Mail', 'machine', 40)], 
          boss: E('Middle Manager', 'suit', 55) },
        { 
          id: 's4', 
          name: 'Emergency Training: Office Fire', 
          req: 7, 
          rewardXp: 400, 
          minRarity: 2,
          encounters: [E('Burning Copier', 'machine', 35), E('Panicking Coworker', 'suit', 40), E('Missplaced Delivery Packages', 'machine', 40)], 
          boss: E('Keycard Passage System', 'robot', 60) },
        { 
          id: 's5', 
          name: 'Coffee Break', 
          req: 9, 
          rewardXp: 500, 
          minRarity: 3,
          encounters: [E('Cold Cup of Coffee', 'bird', 40), E('"#1 Boss" Mug', 'suit', 40), E('Plug-n-Play Coffee Machine', 'robot', 45)], 
          boss: E('The Infinite Program Dishwasher', 'suit', 65) },
        { 
          id: 's6', 
          name: 'After Work', 
          req: 11, 
          rewardXp: 700, 
          minRarity: 3,
          encounters: [E('Bad Domeage Beverage', 'suit', 45), E('Oversharing Coworker', 'suit', 45), E('Cocktail of Bad Luck', 'robot', 50)], 
          boss: E('The CEO', 'ceo', 80) }
      ],
      agility: [
        { id: 'a1', name: 'First Day', req: 1, rewardXp: 150, minRarity: 1, encounters: [L('Get to the office', 'office', 5)], boss: L('Beat the 9am deadline', 'clock', 6) },
        { id: 'a2', name: 'Client Visit', req: 3, rewardXp: 200, minRarity: 1, encounters: [L('Cross town to the client', 'office', 5)], boss: L('Catch the last train home', 'train', 8) },
        { id: 'a3', name: 'Business Trip', req: 5, rewardXp: 300, minRarity: 2,
          encounters: [L('Run to the station', 'train', 5), L('Airport express', 'train', 6), L('Terminal sprint', 'plane', 6)], boss: L('Make the flight', 'plane', 8) },
        { id: 'a4', name: 'Company Offsite', req: 7, rewardXp: 400, minRarity: 2,
          encounters: [L('Cross the city on foot', 'office', 7), L('Ferry dash', 'train', 7), L('Hill-top retreat', 'office', 8)], boss: L('Beat the last bus', 'taxi', 10) },
        { id: 'a5', name: 'Big Conference', req: 9, rewardXp: 500, minRarity: 3,
          encounters: [L('Convention centre loop', 'office', 8), L('Hotel to expo hall', 'office', 8), L('Keynote sprint', 'clock', 9)], boss: L('Make the keynote', 'clock', 12) },
        { id: 'a6', name: 'The Great Commute', req: 11, rewardXp: 700, minRarity: 3,
          encounters: [L('Cross the river', 'office', 10), L('Over the mountain', 'office', 10), L('Through the city', 'office', 12)], boss: L('Race the rush hour', 'train', 15) }
      ]
    }
  },
  punk:   { name: 'Punk', blurb: '', enabled: false },
  athlete: { name: 'Athlete', blurb: '', enabled: false },
  hippie: { name: 'Hippie', blurb: '', enabled: false }
};
