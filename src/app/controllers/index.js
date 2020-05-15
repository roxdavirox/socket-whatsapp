/* eslint-disable global-require */
const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  fs.readdirSync(__dirname)
    .filter((file) => ((file.indexOf('.') !== 0 && (file !== 'index.js'))))
    // eslint-disable-next-line import/no-dynamic-require
    .forEach((file) => require(path.resolve(__dirname, file))(app));
};
