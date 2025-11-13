const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const API_KEY = process.env.BOLDDESK_API;
const BASE_URL = "https://shlokglid.bolddesk.com/api/v1.0";

async function getTickets() {
  try {
    const response = await axios.get(`${BASE_URL}/tickets`, {
      headers: {
        "x-api-key": API_KEY,
        "Accept": "application/json"
      }
    });

    // Return the tickets array
    return response.data.result || [];
  } catch (error) {
    if (error.response) {
      console.error("Error:", error.response.status, error.response.data);
      throw error; // propagate error to controller
    } else {
      console.error("Error:", error.message);
      throw error;
    }
  }
}


async function createTicket(subject, description, priorityId, brandId, requester) {
  try {
    let requesterId;

    // Step 1: Check if contact exists
    const userResp = await axios.get(`${BASE_URL}/contacts?searchText=${requester.email}`, {
      headers: { "x-api-key": API_KEY, Accept: "application/json" },
    });

    if (userResp.data?.result?.length > 0) {
      requesterId = userResp.data.result[0].id;
    } else {
      // Step 2: Create a new contact
      const newUser = await axios.post(`${BASE_URL}/contacts`, {
        Email: requester.email,
        Name: requester.name || "Guest User",
      }, {
        headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      });
      requesterId = newUser.data.result.id;
    }

    // Step 3: Create ticket with valid RequesterId
    const ticketData = {
      BrandId: brandId,
      Subject: subject,
      Description: description,
      PriorityId: priorityId,
      RequesterId: requesterId,
    };

    const response = await axios.post(`${BASE_URL}/tickets`, ticketData, {
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("Ticket Created:", response.data);
    return response.data;

  } catch (error) {
    if (error.response) {
      console.error("Error:", error.response.status, error.response.data);
      throw error;
    } else {
      console.error("Error:", error.message);
      throw error;
    }
  }
}




module.exports = { getTickets, createTicket };