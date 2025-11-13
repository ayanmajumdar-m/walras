import React, { useEffect } from "react";
import "./SubmitTicket.css";

function SubmitTicket() {
  useEffect(() => {
    // Load the BoldDesk script
    const script = document.createElement('script');
    script.src = 'https://shlokglid.bolddesk.com/webform/embedcode';
    script.type = 'application/javascript';
    script.async = true;
    script.defer = true;
    
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="submit-ticket-container">
      <h2>Submit a Support Ticket</h2>
      <iframe 
        id="bdfeedbackwidgetframe" 
        className="bolddeskwidgetform" 
        height="600" 
        allowTransparency="false" 
        frameBorder="0" 
        border="0" 
        src="https://shlokglid.bolddesk.com/webform/8e5db0a1-2ddf-4a93-9a2c-ee40fbdfd146/feedbackform"
        style={{ width: '100%', border: 'none', minHeight: '600px' }}
        title="BoldDesk Support Ticket Form"
      ></iframe>
    </div>
  );
}

export default SubmitTicket;