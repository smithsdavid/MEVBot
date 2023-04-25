# Admin Check

![Version](https://img.shields.io/github/v/release/denizariyan/admin-check)
![Node.js CI](https://github.com/denizariyan/admin-check/workflows/Node.js%20CI/badge.svg)

Admin Check is an NPM package to check if the current script is running with admin privileges. 

Currently only available for Windows. It uses a native Windows command("net session") that is only available with admin privileges to check if the admin privileges are present.

## Installation

Use the package manager NPM to install Admin Check.

```bash
npm i admin-check
```

## Usage

Returns a `<Boolean>` which is true when admin privileges are present.
```nodejs
const admin = require("admin-check");

admin.check().then(result => {
  if (result) {
    // Do something when admin privileges are present
  } else {
    // Do something when admin privileges are NOT present
  }
});
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.


## License
[MIT](https://github.com/denizariyan/admin-check/blob/main/LICENSE.md)
