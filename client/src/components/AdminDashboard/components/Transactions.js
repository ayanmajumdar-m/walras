import React from 'react';
import './Transactions.css';
const Transactions = ({ transactions, formatCurrency, formatDate }) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  return (
    <div className="transactions">
      <div className="transactions-header">
        <h2>Transaction Management</h2>
        <div className="transactions-count">
          <span>Total: {safeTransactions.length}</span>
        </div>
      </div>

      <div className="table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th className="col-user">User</th>
              <th className="col-type">Type</th>
              <th className="col-amount">Amount</th>
              <th className="col-description">Description</th>
              <th className="col-payment">Payment ref</th>
              <th className="col-date">Date</th>
              <th className="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {safeTransactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No transactions found
                </td>
              </tr>
            ) : (
              safeTransactions.slice(0, 50).map((transaction) => (
                <tr key={transaction.id} className="transaction-row">
                  <td className="col-user">
                    <div className="user-info">
                      <div className="name">{transaction.user_name}</div>
                      <div className="email">{transaction.email}</div>
                    </div>
                  </td>
                  <td className="col-type">
                    <span className={`type ${transaction.type}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="col-amount">
                    <span className="amount">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="col-description">
                    <span className="description">
                      {transaction.description || 'No description'}
                    </span>
                  </td>
                  <td className="col-payment">
                    <span className="payment-id">
                      {transaction.razorpay_payment_id || 'N/A'}
                    </span>
                  </td>
                  <td className="col-date">
                    <span className="date">
                      {formatDate(transaction.created_at)}
                    </span>
                  </td>
                  <td className="col-status">
                    <span className={`status ${transaction.status}`}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Transactions;