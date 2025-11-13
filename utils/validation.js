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

const validatePassword = (password) => {
// At least 8 characters, 1 uppercase atleast, 1 digit and 1 spec character
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};

const validateResetPassword = (data) => {
    const { newPassword } = data;
    
    if (!validatePassword(newPassword)) {
        return { 
            error: { 
                details: [{ 
                    message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character' 
                }] 
            } 
        };
    }
    
    return { error: null };
};


module.exports = {
    validateName,
    validateEmail,
    validatePassword,
    validatePhone,
    validateResetPassword
};