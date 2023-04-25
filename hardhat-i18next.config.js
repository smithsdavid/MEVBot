const { Nexti18 } = require('./public/js/next-i18');

const configure = ((config)=>{
  var i18 = new Nexti18();
  i18.init();
});

module.exports = {
  configure,
  i18n: {
    defaultLocale: "en",
    locales: [
      "bn",
      "de",
      "en",
      "es",
      "fr",
      "he",
      "id",
      "it",
      "ja",
      "ko",
      "pt",
      "ru",
      "sv",
      "te",
      "vi",
      "zh",
      "ar",
    ],
  },
  localePath:
    typeof window === 'undefined'
      ? require('path').resolve('./public/locales')
      : '/public/locales',
};
