/* env { es6: false } */

if (process.env.NODE_ENV === 'production') {
  process.exit(0);
}

require('babel-register');
require('./main');
