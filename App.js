// App.js - Main application component
// This file handles the UI and interactions with the Ethereum blockchain

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';  // Library for interacting with Ethereum
import './App.css';
import PollDAppABI from './PollDAppABI.json';  // The ABI defines how to interact with the smart contract

// Contract address - The deployed address of your PollDApp smart contract on the blockchain
const CONTRACT_ADDRESS = "0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47";

function App() {
  // State variables to manage the application data
  const [account, setAccount] = useState('');  // Current connected wallet address
  const [contract, setContract] = useState(null);  // Reference to the smart contract
  const [polls, setPolls] = useState([]);  // List of all polls
  const [leaderboard, setLeaderboard] = useState([]);  // List of polls sorted by votes
  const [loading, setLoading] = useState(true);  // Loading state for UI feedback
  const [newPollQuestion, setNewPollQuestion] = useState('');  // For creating new polls
  const [newPollOptions, setNewPollOptions] = useState(['', '']);  // Options for new polls

  // Function to connect user's wallet (MetaMask) to the application
  async function connectWallet() {
    try {
      // Request user's permission to connect their wallet
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      setAccount(account);

      // Set up a provider and signer using ethers.js
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Create a contract instance to interact with the smart contract
      const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);
      setContract(pollContract);

      // Load polls and leaderboard data
      await loadPolls(pollContract);
      await loadLeaderboard(pollContract);

      setLoading(false);
      return pollContract;
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      alert("Failed to connect to wallet.");
      setLoading(false);
      return null;
    }
  }

  // Function to reset all polls in the contract (admin function)
  async function resetPolls() {
    try {
      if (!contract) return;

      // Call the resetAllPolls function on the smart contract
      const tx = await contract.resetAllPolls();
      await tx.wait();  // Wait for transaction to be mined
      console.log("All polls have been reset");

      // Reload polls and leaderboard data
      await loadPolls(contract);
      await loadLeaderboard(contract);
    } catch (error) {
      console.error("Error resetting polls:", error);
    }
  }

  // Function to load all polls from the smart contract
  const loadPolls = async (pollContract) => {
    try {
      // Get the total number of polls
      const count = await pollContract.getPollCount();
      const pollData = [];
  
      // Fetch each poll's details
      for (let i = 0; i < count; i++) {
        try {
          const poll = await pollContract.getPoll(i);
          if (!poll.question || poll.creator === ethers.constants.AddressZero) continue;
  
          // Format the poll data for use in the UI
          pollData.push({
            id: i,
            question: poll.question,
            options: poll.options,
            voteCounts: poll.voteCounts.map(v => v.toNumber()),  // Convert BigNumber to regular number
            totalVotes: poll.totalVotes.toNumber(),
            creator: poll.creator
          });
        } catch (err) {
          console.warn(`Skipping poll ${i}: ${err.message}`);
          continue;  // Skip polls that can't be loaded
        }
      }
  
      // Update the polls state with the fetched data
      setPolls(pollData);
    } catch (err) {
      console.error("Error loading polls:", err);
    }
  };
  
  // Function to load the leaderboard - polls sorted by popularity
  const loadLeaderboard = async (pollContract) => {
    try {
      // Get sorted poll IDs from the smart contract
      const leaderboardIds = await pollContract.getLeaderboard();
      const pollData = [];
  
      // Fetch details for each poll in the leaderboard
      for (let i = 0; i < leaderboardIds.length; i++) {
        const pollId = leaderboardIds[i].toNumber();
  
        try {
          const poll = await pollContract.getPoll(pollId);
          if (!poll.question || poll.creator === ethers.constants.AddressZero) continue;
  
          // Format the poll data for the leaderboard UI
          pollData.push({
            id: pollId,
            question: poll.question,
            totalVotes: poll.totalVotes.toNumber()
          });
        } catch (err) {
          console.warn(`Skipping leaderboard poll ${pollId}: ${err.message}`);
          continue;  // Skip polls that can't be loaded
        }
      }
  
      // Update the leaderboard state with the fetched data
      setLeaderboard(pollData);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    }
  };
  
  // Function to create a new poll
  async function createPoll(e) {
    e.preventDefault();  // Prevent page reload on form submission
    try {
      // Filter out empty options
      const options = newPollOptions.filter(option => option.trim() !== '');
      if (options.length < 2) {
        alert("You need at least 2 options for a poll");
        return;
      }

      setLoading(true);
      // Call the createPoll function on the smart contract
      const tx = await contract.createPoll(newPollQuestion, options);
      await tx.wait();  // Wait for transaction to be mined

      // Reset form fields
      setNewPollQuestion('');
      setNewPollOptions(['', '']);

      // Reload polls and leaderboard data
      await loadPolls(contract);
      await loadLeaderboard(contract);
      
      setLoading(false);
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Failed to create poll.");
      setLoading(false);
    }
  }

  // Function to vote on a poll
  async function vote(pollId, optionIndex) {
    try {
      if (!contract) {
        alert("Contract not initialized.");
        return;
      }
  
      setLoading(true);
      // Call the vote function on the smart contract
      const tx = await contract.vote(pollId, optionIndex);
      await tx.wait();  // Wait for transaction to be mined
  
      // Reload polls and leaderboard data
      await loadPolls(contract);
      await loadLeaderboard(contract);
      setLoading(false);
      alert("Vote cast successfully!");
    } catch (error) {
      setLoading(false);
  
      // Handle the specific error of users trying to vote twice
      if (
        error.code === 'UNPREDICTABLE_GAS_LIMIT' &&
        error.message.includes("You have already voted on this poll")
      ) {
        alert("❌ You have already voted on this poll.");
      } else {
        console.error("Error voting:", error);
        alert("Failed to vote: " + (error.reason || error.message));
      }
    }
  }
  
  // Function to add a new option field when creating a poll
  function addOption() {
    setNewPollOptions([...newPollOptions, '']);
  }

  // Function to remove an option field when creating a poll
  function removeOption(index) {
    if (newPollOptions.length <= 2) {
      alert("A poll must have at least 2 options");
      return;
    }
    const updated = [...newPollOptions];
    updated.splice(index, 1);
    setNewPollOptions(updated);
  }

  // Function to update an option's text when creating a poll
  function updateOption(index, value) {
    const updated = [...newPollOptions];
    updated[index] = value;
    setNewPollOptions(updated);
  }

  // useEffect hook to run when the component mounts
  useEffect(() => {
    if (!window.ethereum) {
      alert("MetaMask is not installed.");
      setLoading(false);
      return;
    }
  
    // Function to initialize the app
    const initialize = async () => {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      // Try to get the user's address if they're already connected
      const userAddress = await signer.getAddress().catch(() => null);
  
      if (userAddress) {
        // User is already connected
        setAccount(userAddress);
        const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);
        setContract(pollContract);
  
        // Load initial data
        await loadPolls(pollContract);
        await loadLeaderboard(pollContract);
  
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
  
    initialize();
  
    // Set up an event listener for when the user changes accounts in MetaMask
    window.ethereum.on('accountsChanged', async (accounts) => {
      setAccount(accounts[0]);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const pollContract = new ethers.Contract(CONTRACT_ADDRESS, PollDAppABI, signer);
  
      // Reload data when accounts change
      await loadPolls(pollContract);
      await loadLeaderboard(pollContract);
    });
  }, []);  // Empty dependency array means this runs once on component mount
  
  // The UI of the application
  return (
    <div className="App">
      <header className="App-header">
        <h1>DeFi Poll DApp</h1>
        <p>Create and participate in polls on the blockchain</p>
        {account ? (
          // Show connected account if available
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
        ) : (
          // Show connect button if not connected
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>

      <main>
        {loading ? (
          // Show loading message when data is being fetched
          <div className="loading">Loading...</div>
        ) : (
          <>
            {/* Form section to create a new poll */}
            <section className="create-poll">
              <h2>Create a New Poll</h2>
              <form onSubmit={createPoll}>
                <div className="form-group">
                  <label>Question:</label>
                  <input
                    type="text"
                    value={newPollQuestion}
                    onChange={(e) => setNewPollQuestion(e.target.value)}
                    required
                    placeholder="Enter your poll question"
                  />
                </div>
                <div className="form-group">
                  <label>Options:</label>
                  {/* Render inputs for each option */}
                  {newPollOptions.map((option, index) => (
                    <div key={index} className="option-row">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        required
                        placeholder={`Option ${index + 1}`}
                      />
                      <button type="button" onClick={() => removeOption(index)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={addOption}>Add Option</button>
                </div>
                <button type="submit">Create Poll</button>
              </form>
            </section>

            {/* Section to display all polls */}
            <section className="polls">
              <h2>All Polls</h2>
              {polls.length === 0 ? (
                <p>No polls yet.</p>
              ) : (
                <div className="polls-grid">
                  {/* Render each poll as a card */}
                  {polls.map(poll => (
                    <div key={poll.id} className="poll-card">
                      <h3>{poll.question}</h3>
                      <p>Total votes: {poll.totalVotes}</p>
                      <div className="options">
                        {/* Render each option with its vote count and voting button */}
                        {poll.options.map((option, idx) => (
                          <div key={idx} className="option">
                            <div className="option-info">
                              <span>{option}</span>
                              <span>{poll.voteCounts[idx]} votes</span>
                            </div>
                            {/* Progress bar to visualize vote distribution */}
                            <div className="progress-bar">
                              <div
                                className="progress"
                                style={{
                                  width: poll.totalVotes > 0
                                    ? `${(poll.voteCounts[idx] / poll.totalVotes) * 100}%`
                                    : '0%'
                                }}
                              ></div>
                            </div>
                            {/* Vote button (hidden if user already voted) */}
                            {!poll.hasVoted && (
                              <button onClick={() => vote(poll.id, idx)}>Vote</button>
                            )}
                          </div>
                        ))}
                      </div>
                      {poll.hasVoted && <p>You've already voted</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section to display leaderboard */}
            <section className="leaderboard">
              <h2>Leaderboard</h2>
              {leaderboard.length === 0 ? (
                <p>No leaderboard yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Poll</th>
                      <th>Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render each poll in the leaderboard */}
                    {leaderboard.map((poll, idx) => (
                      <tr key={poll.id}>
                        <td>{idx + 1}</td>
                        <td>{poll.question}</td>
                        <td>{poll.totalVotes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>

      <footer>
        <p>Simple DeFi Poll DApp - Created for blockchain beginners</p>
      </footer>
    </div>
  );
}

export default App;