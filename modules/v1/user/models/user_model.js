const randtoken = require('rand-token').generator();
const common = require("../../../../config/common");
const lang = require("../../../../config/language");
const Codes = require("../../../../config/status_codes");
const UserSchema = require("../../../schema/user_schema");
// const OtpSchema = require('../../../schema/otp_schema');
// const UserCompanySchema = require("../../../schema/user_company_schema");
// const AddressSchema = require("../../../schema/address_schema");
// const UserAgreementTermsSchema = require("../../../schema/user_agreement_terms_schema");
const middleware = require("../../../../middleware/headerValidator");
const template = require("../../../../config/template");
const redis = require("../../../../config/redis");

const userModel = {


    async register(req, res) {

           const checkEmailUnique = await common.checkUniqueEmail(req);
        if (checkEmailUnique) {
            return await middleware.sendResponse(res, Codes.NOT_FOUND, lang[req.language].rest_keywords_unique_email_error, null)
        }
        const checkMobileUnique = await common.checkUniqueMobile(req.mobile_number);
        if (checkMobileUnique) {
            return await middleware.sendResponse(res, Codes.NOT_FOUND, lang[req.language].rest_keywords_unique_mobilenumber_error, null)
        }
        const encPass = await middleware.encryption(req.password);
    
        // Generate a unique token
        const token = randtoken.generate(64, "0123456789abcdefghijklnmopqrstuvwxyz");
    
        // Check if the token already exists in the database
        const existingUser = await UserSchema.findOne({ 'device_info.token': token });
    
        // If the token exists, generate a new one
        if (existingUser) {
            // You might want to add a loop with a limit to avoid potential infinite loops
            return this.register(req, res);
        }
    
        // Create user device object
        let user_device = {
            token: token,
            device_type: (req.device_type !== undefined) ? req.device_type : "A",
            device_token: (req.device_token !== undefined) ? req.device_token : "1234",
        };
    
        // Create user object
        let user = {
            first_name: req.first_name,
            last_name: req.last_name,
            email: req.email,
            mobile_number: req.mobile_number,
            password: encPass,
            otp_code: (req.otp_code !== undefined) ? req.otp_code : "",
            is_verify: (req.is_verify !== undefined) ? req.is_verify : "0",
            profile_image: (req.profile_image !== undefined) ? req.profile_image : "default.jpg",
            device_info: user_device
        };
    
        // Generate OTP
        let OTP = Math.floor(1000 + Math.random() * 9000);
        user.otp_code = OTP;
    
        // Create a new user instance
        const newUser = new UserSchema(user);
    
        // Validate and save the user
        try {
            await newUser.validate();
            const response = await newUser.save();
            // delete response.password;
            return middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_success_message, response);
        } catch (error) {
            console.log('getting error here ===>', error);
            return middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_adduserdata_error_message, error);
        }
    },
    


    async otp_verification(req, res) {
        const userData = await UserSchema.findOne({ $and: [{ email: req.email }, { is_active: "1" }, { is_deleted: "0" }] });
        if (!userData) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_userdatanotfound_message, null);
        }
        if (userData.otp_code != req.otp) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_userotpdata_notvalid_message, null);
        }
        let upd_params = {
            otp_code: "",
            is_verify: "1"
        }
        const filter = { email: req.email };
        const update = { $set: upd_params };
        let update_user = await UserSchema.updateOne(filter, update);
        if (update_user.modifiedCount <= 0) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        }
        const response = await UserSchema.findOne({ $and: [{ email: req.email }, { is_active: "1" }, { is_deleted: "0" }] });
        
        return await middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_otpverified_success_message, response);
    },

    async resend_user_otp(req, res) {
        const userData = await UserSchema.findOne({ $and: [{ mobile: req.mobile }, { is_active: "1" }, { is_deleted: "0" }] });
        if (!userData) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_userdatanotfound_message, null);
        }
        let OTP = Math.floor(1000 + Math.random() * 9000);
        let upd_params = {
            otp_code: OTP
        }
        const filter = { _id: userData._id };
        const update = { $set: upd_params };
        let update_user = await UserSchema.updateOne(filter, update);
        if (update_user.modifiedCount <= 0) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        }
        // let data = await userModel.userData(userData._id);
        // console.log('aaa', userData);
        return await middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_sendotp_success_message, upd_params);
    },

    async login(req, res) {
        console.log('REQUEST,',req);
        const userData = await UserSchema.findOne({ $and: [{ email: req.email}, { is_deleted: "0" }] });
        console.log('userData++++++++++++++++++++++++++++,',userData);
        if (!userData) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_userdatanotfound_message, null);
        }
        if (userData.is_active == '0') {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_isactive_error_message, null);
        }
        let password = await middleware.encryption(req.password);
        if (userData.password != password) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_password_notvalid_message, null);
        }

        // if (userData.is_verify == "0") {
        //     let OTP = Math.floor(1000 + Math.random() * 9000);
        //     let upd_params = {
        //         otp_code: OTP
        //     }
        //     const filter = { _id: userData._id };
        //     const update = { $set: upd_params };
        //     let update_user = await UserSchema.updateOne(filter, update);
        //     if (update_user.modifiedCount <= 0) {
        //         return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        //     }
        //     return await middleware.sendResponse(res, Codes.UNAUTHORIZED, lang[req.language].rest_keywords_sendotp_success_message, upd_params);
        // }
        
        const token = randtoken.generate(64, "0123456789abcdefghijklnmopqrstuvwxyz");
        let update_token = await UserSchema.updateOne(
            { _id: userData.id },
            { $set: { "device_info.token": token } }
        )
        if (update_token.modifiedCount <= 0) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        }
        
        let data = await userModel.getuserData(userData.id);
        return await middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_login_success_message, data);
    },

    async updatePassword(req, res) {
        const userData = await UserSchema.findOne({ $and: [{ mobile: req.mobile }, { is_deleted: "0" }] });
        if (!userData) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_userdatanotfound_message, null);
        }
        if (userData.is_active == '0') {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_isactive_error_message, null);
        }
        const new_password = await middleware.encryption(req.new_password);
        if (userData.password == new_password) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_same_password_message, null);
        }
        let upd_params = {
            password: new_password
        }
        const filter = { _id: userData._id };
        const update = { $set: upd_params };
        let update_pass = await UserSchema.updateOne(filter, update);
        if (update_pass.modifiedCount <= 0) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        }
        return await middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_password_change_success_message, null);
    },

    async logout(req, res) {
        let update_token = await UserSchema.updateOne(
            { _id: req.user_id },
            { $set: { "device_info.token": "" } }
        )
        if (update_token.modifiedCount <= 0) {
            return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
        }
        return await middleware.sendResponse(res, Codes.SUCCESS, lang[req.language].rest_keywords_logout_success_message, null);
    },

 async userList(req, res) {
    let userlistdetails = await UserSchema.find();
    
    if(userlistdetails.length>0){
      
        return await middleware.sendResponse(res, Codes.SUCCESS, 'Success', { userList: userlistdetails });
    }else{
        console.log('errrrr');
        return await middleware.sendResponse(res, Codes.ERROR, lang[req.language].rest_keywords_err_message, null);
    }
},



    async getuserData(user_id) {
        let userData = await UserSchema.findOne({ _id: user_id });
        return userData;
    }
}

module.exports = userModel;
