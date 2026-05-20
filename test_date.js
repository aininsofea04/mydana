const now = new Date();
const dt = new Date();
const diffTime = Math.abs(now - dt);
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
console.log("diffDays", diffDays);
