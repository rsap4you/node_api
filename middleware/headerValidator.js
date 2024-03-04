const Validator = require('Validator');
const CryptLib = require('cryptlib');
const crypto = require('crypto-js')

const lang = require("../config/language");
const logger = require('../logger');
const Codes = require('../config/status_codes');
const UserSchema = require("../modules/schema/user_schema");
const shakey = CryptLib.getHashSha256(process.env.KEY, 32);

const SECRET = crypto.enc.Hex.parse(process.env.KEY);
const IV = crypto.enc.Hex.parse(process.env.IV);

// methods that do not check token
const bypassMethod = new Array("encryption_demo", "decryption_demo", "resend-user-otp", "otp-verification", "register", "login", "update-password");

// method that not require api key
const bypassHeaderKey = new Array("encryption_demo", "decryption_demo", "sendnotification", "resetpasswordForm", "resetPass");

const headerValidator = {

    // function for extract accept language from request header and set in req globaly
    extractHeaderLanguage: async (req, res, next) => {
        try {
            const language = (req.headers['accept-language'] !== undefined && req.headers['accept-language'] !== '') ? (req.headers['accept-language'] === 'en-GB,en-US;q=0.9,en;q=0.8' ? 'en' : req.headers['accept-language']) : 'en';
            req.language = language;
            next()
        } catch (error) {
            logger.error(error.message);
        }

    },

    // Function to validate API key of header (Note : Header keys are encrypted)
    validateHeaderApiKey: async (req, res, next) => {
        try {
            const apiKey = req.headers['api-key'] !== undefined && req.headers['api-key'] !== "" ? req.headers['api-key'] : '';
            const pathData = req.path.split("/");
            if (bypassHeaderKey.indexOf(pathData[2]) === -1) {
                if (apiKey !== '') {
                    const decApiKey = (req.headers['api-key'] != undefined && req.headers['api-key'] != '') ? crypto.AES.decrypt(req.headers['api-key'], SECRET, { iv: IV }).toString(crypto.enc.Utf8) : "";
                    // const decApiKey = JSON.parse(CryptoJS.AES.decrypt(apiKey, SECRET, { iv: IV }));
                    if (decApiKey === `"${process.env.API_KEY}"`) {
                        next();
                    } else {
                        return await headerValidator.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_api_notvalid_message, null);
                    }
                } else {
                    return await headerValidator.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_api_notvalid_message, null);
                }
            } else {
                next();
            }


        } catch (error) {
            logger.error(error.message);
            // return await headerValidator.sendResponse(res, Codes.INTERNAL_ERROR, 'An Error Occurred', null);
        }
        return false;
    },

    // Function to validate the token of any user before every request
    validateHeaderToken: async (req, res, next) => {
        try {
            const headerToken = (req.headers.token !== undefined && req.headers.token !== '') ? req.headers.token : '';
            const pathData = req.path.split("/");

            if (bypassMethod.indexOf(pathData[2]) === -1) {
                if (headerToken !== '') {
                    try {
                        let token = crypto.AES.decrypt(headerToken, SECRET, { iv: IV }).toString(crypto.enc.Utf8);
                        token = token.replace(/"/g, '');
                        // const token = CryptLib.decrypt(headerToken, shakey, process.env.IV);
                        const userDetails = await UserSchema.findOne({ "device_info.token": token })
                        if (userDetails !== null && userDetails !== undefined) {
                            req.user_id = userDetails.id;
                            next();
                        } else {
                            return headerValidator.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_token_notvalid_message, null);
                        }
                    } catch (error) {
                        return headerValidator.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_token_notvalid_message, null);
                    }
                } else {
                    return headerValidator.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_token_notvalid_message, null);
                }
            } else {
                next();
            }
        } catch (error) {
            return headerValidator.sendResponse(res, Codes.INTERNAL_ERROR, 'An Error Occurred', null);
        }
        return false;
    },

    // Decrypt user request
    decryption: async (req) => {
        try {
            let data1 = req.body;
            // console.log('req.body: ', req.body);
            // const decryptedData = JSON.parse(crypto.AES.decrypt(data1, SECRET, { iv: IV }).toString(crypto.enc.Utf8));
            const decryptedData = await crypto.AES.decrypt(data1, SECRET, { iv: IV }).toString(crypto.enc.Utf8);
            // console.log('decryptedData: ', decryptedData);
            let data = headerValidator.isJson(decryptedData);
            // console.log('data: ', data);
            data.language = req.language
            data.user_id = req.user_id
            return data;
        } catch (error) {
            console.log('error: ', error);
            return {};
        }
    },

    // decryption: async (req) => {
    //     try {
    //         if (req.body !== undefined && Object.keys(req.body).length !== 0) {
    //             let encryptedData = req.body; // replace 'encryptedData' with the actual key in req.body
    //             console.log(' typeof encryptedData: ', typeof (encryptedData));
    //             console.log('encryptedData: ', encryptedData);
    //             const cipherParams = crypto.enc.Base64.parse(encryptedData);

    //             const decrypted = crypto.AES.decrypt(cipherParams, SECRET, { iv: IV }).toString(crypto.enc.Utf8);
    //             console.log('decrypted: ', decrypted);

    //             // If the decrypted data is in JSON format, you can parse it
    //             const request = JSON.parse(decrypted);
    //             console.log('request: ', request);

    //             return request;
    //         }
    //     } catch (error) {
    //         console.error('Decryption error: ', error);
    //         return {};
    //     }
    // },

    //     decryption: async (req) => {
    //     try {
    //         if (req.body !== undefined && Object.keys(req.body).length !== 0) {
    //             let encryptedData = req.body; // replace 'encryptedData' with the actual key in req.body
    //             console.log(' typeof encryptedData: ', typeof (encryptedData));
    //             console.log('encryptedData: ', encryptedData);

    //             // Convert the encrypted data string into a CipherParams object
    //             const cipherParams = crypto.enc.Base64.parse(encryptedData);

    //             const decrypted = crypto.AES.decrypt(cipherParams, SECRET, { iv: IV }).toString(crypto.enc.Utf8);
    //             console.log('decrypted: ', decrypted);

    //             // If the decrypted data is in JSON format, you can parse it
    //             const request = JSON.parse(decrypted);
    //             console.log('request: ', request);

    //             return request;
    //         }
    //     } catch (error) {
    //         console.error('Decryption error: ', error);
    //         return {};
    //     }
    // },


    // Encrypt user request
    encryption: async (req) => {
        try {
            let data = headerValidator.isJson(req);
            const encryptedData = crypto.AES.encrypt(JSON.stringify(data), SECRET, { iv: IV }).toString();
            return encryptedData;

        } catch (error) {
            console.log('error: ', error);
            return {};
        }
    },

    encryptiondemo: (req, res) => {
        try {
            let data = headerValidator.isJson(req);
            const encryptedData = crypto.AES.encrypt(JSON.stringify(data), SECRET, { iv: IV }).toString();
            console.log('encryptedData: ', encryptedData);
            res.json(encryptedData);

        } catch (error) {
            return '';
        }
    },

    decryptiondemo: async (req, res) => {
        try {
            const decryptedData = JSON.parse(crypto.AES.decrypt(req, SECRET, { iv: IV }).toString(crypto.enc.Utf8));
            let data = headerValidator.isJson(decryptedData);
            res.json(data);
        } catch (error) {
            return {};
        }

    },
    
    // check req data is json or string
    isJson: (req) => {
        try {
            const parsedObject = JSON.parse(req);
            return parsedObject;
            // return parsedObject;
        } catch (error) {
            return req;
            // JSON parsing failed, return the original string
            // return req;
        }

    },


    // function for send Response
    sendResponse: async (res, resCode, msgKey, resData) => {
        try {
            const responsejson =
            {
                "code": resCode,
                "message": msgKey

            }
            if (resData != null) {
                responsejson.data = resData;
            }
            const result = await headerValidator.encryption(responsejson);
            res.status(resCode).send(result);

        } catch (error) {
            logger.error(error.message);
        }

    },

    // check Validation Rules
    checkValidationRules: async (request, rules) => {
        try {
            const v = Validator.make(request, rules);
            const validator = {
                status: true,
            }
            if (v.fails()) {
                const ValidatorErrors = v.getErrors();
                validator.status = false
                for (const key in ValidatorErrors) {
                    validator.error = ValidatorErrors[key][0];
                    break;
                }
            }
            return validator;
        } catch (error) {
            logger.error(error.message);
        }
        return false;

    },

}
module.exports = headerValidator