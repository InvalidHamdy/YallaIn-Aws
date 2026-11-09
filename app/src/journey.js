// The registration journey, in order. users.registration_step stores the NEXT page the user must see.
const STEPS = {
  VERIFY: 2,      // WR3 Verify mobile
  EMAIL: 3,       // WR4 Add email
  NATIONAL_ID: 4, // WR5 National ID
  ID_PHOTO: 5,    // WR6 ID photo
  ID_STATUS: 6,   // WR7 ID verified / pending
  FAVORITES: 7,   // WR8 Pick favorites
  DONE: 8,        // Home
};

const PATH_FOR_STEP = {
  [STEPS.VERIFY]: '/verify',
  [STEPS.EMAIL]: '/email',
  [STEPS.NATIONAL_ID]: '/national-id',
  [STEPS.ID_PHOTO]: '/id-photo',
  [STEPS.ID_STATUS]: '/id-status',
  [STEPS.FAVORITES]: '/favorites',
  [STEPS.DONE]: '/home',
};

// The 6 items in the left-hand step tracker (Figma WR2–WR8).
const TRACKER = [
  { n: 1, label: 'Create account' },
  { n: 2, label: 'Verify mobile' },
  { n: 3, label: 'Add email' },
  { n: 4, label: 'National ID' },
  { n: 5, label: 'ID photo' },
  { n: 6, label: 'Favorites' },
];

const pathForStep = (step) => PATH_FOR_STEP[step] || '/home';

module.exports = { STEPS, TRACKER, pathForStep };
