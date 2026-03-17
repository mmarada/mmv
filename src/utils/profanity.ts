// A simple list of profanity words.
// In a real application, you might want to use a more robust library like 'bad-words'.
export const profanityList = [
  "badword1",
  "badword2",
  "badword3",
  "damn",
  "hell",
  "crap",
  "ass",
  "bitch",
  "fuck",
  "shit",
  // Add more words here
];

export const containsProfanity = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return profanityList.some((word) => lowerText.includes(word.toLowerCase()));
};

export const filterProfanity = (text: string): string => {
  let filteredText = text;
  profanityList.forEach((word) => {
    const regex = new RegExp(word, "gi");
    filteredText = filteredText.replace(regex, "****");
  });
  return filteredText;
};
