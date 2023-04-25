const platform = require("os").platform();

function _check() {
    return new Promise(resolve => { // Has to be a promise since Windows can take quite a while to respond under some circumstances
        if (platform == "win32" || platform == "win64") {
            require('child_process').exec('net session', function (err, stdout, stderr) { // "net session" will return an error when admin privileges are not present 
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else {
            throw new Error('Can not determine if admin priviliges are present or not. This package is only compatible with Windows OS')
        }
      });
}

exports.check = async function () {
        return await _check();
    }
