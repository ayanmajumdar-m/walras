const validateName = (name)=>{
    // Name should be between 3 and 100 characters and can contain letters and spaces
    const nameRegex = /^[a-zA-Z\s]{3,100}$/;
    return nameRegex.test(name);
}

const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{7,15}$/;
    return phoneRegex.test(phone);
}

const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

// Password rules live with the sign-up code in controllers/auth.controllers.js.

module.exports = {
    validateName,
    validateEmail,
    validatePhone
};