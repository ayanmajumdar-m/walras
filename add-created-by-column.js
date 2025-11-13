const connection = require('./config/db');

console.log('Adding created_by column to promo_codes table...');

// Add the created_by column to the existing promo_codes table
const addCreatedByColumn = `
ALTER TABLE promo_codes 
ADD COLUMN created_by INT DEFAULT NULL,
ADD FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
`;

connection.query(addCreatedByColumn, (err, result) => {
    if (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('✅ created_by column already exists in promo_codes table');
        } else {
            console.error('Error adding created_by column:', err);
        }
    } else {
        console.log('✅ created_by column added successfully to promo_codes table!');
    }
    
    connection.end();
});
