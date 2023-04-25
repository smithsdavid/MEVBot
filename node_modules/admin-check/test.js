const admin = require("./index");

admin.check().then(result => {
  if (result) {
    console.log("1");
  } else {
    console.log("0");
  }
});