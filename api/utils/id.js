const { randomUUID } = require('crypto');

function generateId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

module.exports = { generateId };
