import React from 'react';

const Transactions = ({ transactions, formatCurrency, formatDate }) => {
  // Ensure transactions is always an array
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  return (
    <div className="transactions-management">
      <div className="section-header">
        <h3>Transaction Management</h3>
        <div className="transactions-stats">
          <span>Total: {safeTransactions.length}</span>
        </div>
      </div>
      
      <div className="transactions-table">
        <div className="table-header">
          <div className="table-cell">User</div>
          <div className="table-cell">Type</div>
          <div className="table-cell">Amount</div>
          <div className="table-cell">Description</div>
          <div className="table-cell">Payment ID</div>
          <div className="table-cell">Date</div>
          <div className="table-cell">Status</div>
        </div>
        <div className="table-body">
          {safeTransactions.slice(0, 50).map((transaction) => (
            <div key={transaction.id} className="table-row">
              <div className="table-cell">
                <div className="user-info">
                  <strong>{transaction.user_name}</strong>
                  <small>{transaction.email}</small>
                </div>
              </div>
              <div className="table-cell">
                <span className={`transaction-type ${transaction.type}`}>
                  {transaction.type}
                </span>
              </div>
              <div className="table-cell">
                <span className="amount">
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
              <div className="table-cell">
                <span className="description">
                  {transaction.description || 'No description'}
                </span>
              </div>
              <div className="table-cell">
                <span className="payment-id">
                  {transaction.razorpay_payment_id || 'N/A'}
                </span>
              </div>
              <div className="table-cell">
                <span className="date">
                  {formatDate(transaction.created_at)}
                </span>
              </div>
              <div className="table-cell">
                <span className={`status ${transaction.status}`}>
                  {transaction.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
