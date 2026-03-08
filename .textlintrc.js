const path = require("path");

module.exports = {
  rules: {
    [path.join(__dirname, "scripts", "textlint-noop.js")]: true
  }
};
