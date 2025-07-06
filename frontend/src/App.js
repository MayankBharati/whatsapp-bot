import React, { useState, useEffect } from 'react';
import { Send, Calendar, Trash2, Users, MessageCircle, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const WhatsAppPollBot = () => {
  const [botStatus, setBotStatus] = useState(null);
  const [groups, setGroups] = useState([]);
  const [scheduledPolls, setScheduledPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [pollForm, setPollForm] = useState({
    groupId: '',
    question: '',
    options: ['', ''],
    scheduledTime: ''
  });

  const [quickPollForm, setQuickPollForm] = useState({
    groupId: '',
    question: '',
    options: ['', '']
  });

  const API_BASE = 'http://localhost:3000';

  // Fetch bot status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/status`);
      const data = await response.json();
      setBotStatus(data);
    } catch (err) {
      console.error('Failed to fetch bot status:', err);
      setError('Failed to fetch bot status');
    }
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/groups`);
      const data = await response.json();
      // Ensure data is an array
      if (Array.isArray(data)) {
        setGroups(data);
      } else {
        console.error('Groups data is not an array:', data);
        setGroups([]);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('Failed to fetch groups');
      setGroups([]); // Ensure groups remains an array
    }
  };

  // Fetch scheduled polls
  const fetchScheduledPolls = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/polls`);
      const data = await response.json();
      // Ensure data is an array
      if (Array.isArray(data)) {
        setScheduledPolls(data);
      } else {
        console.error('Scheduled polls data is not an array:', data);
        setScheduledPolls([]);
      }
    } catch (err) {
      console.error('Failed to fetch scheduled polls:', err);
      setError('Failed to fetch scheduled polls');
      setScheduledPolls([]); // Ensure scheduledPolls remains an array
    }
  };

  // Send quick poll
  const sendQuickPoll = async () => {
    if (!quickPollForm.groupId || !quickPollForm.question || quickPollForm.options.some(opt => !opt.trim())) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/send-poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickPollForm)
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Poll sent successfully!');
        setQuickPollForm({ groupId: '', question: '', options: ['', ''] });
      } else {
        setError(data.error || 'Failed to send poll');
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Schedule a poll
  const schedulePoll = async () => {
    if (!pollForm.groupId || !pollForm.question || !pollForm.scheduledTime || pollForm.options.some(opt => !opt.trim())) {
      setError('Please fill in all fields');
      return;
    }

    // Validate that the scheduled time is in the future
    const scheduledDate = new Date(pollForm.scheduledTime);
    const now = new Date();
    if (scheduledDate <= now) {
      setError('Please select a future date and time');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/schedule-poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pollForm)
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Poll scheduled successfully!');
        setPollForm({ groupId: '', question: '', options: ['', ''], scheduledTime: '' });
        fetchScheduledPolls();
      } else {
        setError(data.error || 'Failed to schedule poll');
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Delete scheduled poll
  const deletePoll = async (pollId) => {
    if (!window.confirm('Are you sure you want to delete this scheduled poll?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/polls/${pollId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess('Scheduled poll deleted successfully!');
        fetchScheduledPolls();
      } else {
        setError('Failed to delete scheduled poll');
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred');
    }
  };

  // Toggle poll active status
  const togglePoll = async (pollId) => {
    try {
      const response = await fetch(`${API_BASE}/api/polls/${pollId}/toggle`, {
        method: 'PUT'
      });

      if (response.ok) {
        setSuccess('Poll status updated!');
        fetchScheduledPolls();
      } else {
        setError('Failed to update poll status');
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred');
    }
  };

  // Add/remove option fields
  const addOption = (formType) => {
    if (formType === 'scheduled') {
      setPollForm(prev => ({ ...prev, options: [...prev.options, ''] }));
    } else {
      setQuickPollForm(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removeOption = (formType, index) => {
    if (formType === 'scheduled') {
      setPollForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
    } else {
      setQuickPollForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
    }
  };

  // Update option value
  const updateOption = (formType, index, value) => {
    if (formType === 'scheduled') {
      setPollForm(prev => ({
        ...prev,
        options: prev.options.map((opt, i) => i === index ? value : opt)
      }));
    } else {
      setQuickPollForm(prev => ({
        ...prev,
        options: prev.options.map((opt, i) => i === index ? value : opt)
      }));
    }
  };

  // Refresh all data
  const refreshAll = () => {
    fetchStatus();
    fetchGroups();
    fetchScheduledPolls();
  };

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load data on component mount
  useEffect(() => {
    refreshAll();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageCircle className="text-green-600 w-8 h-8" />
              <h1 className="text-2xl font-bold text-gray-800">WhatsApp Poll Bot</h1>
            </div>
            <button
              onClick={refreshAll}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          {/* Status Display */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                {botStatus?.status === 'ready' ? (
                  <CheckCircle className="text-green-500 w-5 h-5" />
                ) : (
                  <XCircle className="text-red-500 w-5 h-5" />
                )}
                <span className="font-medium">Bot Status</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {botStatus?.status || 'Unknown'}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Users className="text-blue-500 w-5 h-5" />
                <span className="font-medium">Groups</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {groups.length || 0} groups found
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="text-purple-500 w-5 h-5" />
                <span className="font-medium">Scheduled Polls</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {scheduledPolls.length || 0} polls scheduled
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Poll Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Send className="text-blue-500 w-5 h-5" />
              <span>Send Quick Poll</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Group
                </label>
                <select
                  value={quickPollForm.groupId}
                  onChange={(e) => setQuickPollForm(prev => ({ ...prev, groupId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a group...</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.participants} members)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poll Question
                </label>
                <input
                  type="text"
                  value={quickPollForm.question}
                  onChange={(e) => setQuickPollForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="What's your question?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options
                </label>
                {quickPollForm.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption('quick', index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Option ${index + 1}`}
                      required
                    />
                    {quickPollForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption('quick', index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption('quick')}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  + Add Option
                </button>
              </div>

              <button
                onClick={sendQuickPoll}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Sending...' : 'Send Poll Now'}</span>
              </button>
            </div>
          </div>

          {/* Schedule Poll Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Calendar className="text-purple-500 w-5 h-5" />
              <span>Schedule One-Time Poll</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Group
                </label>
                <select
                  value={pollForm.groupId}
                  onChange={(e) => setPollForm(prev => ({ ...prev, groupId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a group...</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.participants} members)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poll Question
                </label>
                <input
                  type="text"
                  value={pollForm.question}
                  onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="What's your question?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options
                </label>
                {pollForm.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption('scheduled', index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={`Option ${index + 1}`}
                      required
                    />
                    {pollForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption('scheduled', index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption('scheduled')}
                  className="text-purple-500 hover:text-purple-700 text-sm"
                >
                  + Add Option
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={pollForm.scheduledTime}
                  onChange={(e) => setPollForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select when you want this poll to be sent (one-time only)
                </p>
              </div>

              <button
                onClick={schedulePoll}
                disabled={loading}
                className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Calendar className="w-4 h-4" />
                <span>{loading ? 'Scheduling...' : 'Schedule Poll'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled Polls List */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <Clock className="text-green-500 w-5 h-5" />
            <span>Scheduled Polls</span>
          </h2>
          
          {scheduledPolls.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No scheduled polls found</p>
          ) : (
            <div className="space-y-4">
              {scheduledPolls.map(poll => (
                <div key={poll.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{poll.question}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Group: {poll.groupName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Scheduled for: {new Date(poll.scheduledTime).toLocaleString()}
                      </p>
                      {poll.status && (
                        <p className="text-sm text-gray-600">
                          Status: <span className={`font-medium ${
                            poll.status === 'sent' ? 'text-green-600' : 
                            poll.status === 'pending' ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {poll.status === 'sent' ? 'Sent' : 
                             poll.status === 'pending' ? 'Pending' : 
                             'Failed'}
                          </span>
                        </p>
                      )}
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Options:</p>
                        <ul className="text-sm text-gray-500 ml-4">
                          {poll.options && poll.options.map((option, index) => (
                            <li key={index}>• {option}</li>
                          ))}
                        </ul>
                      </div>
                      {poll.sentAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Sent at: {new Date(poll.sentAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        poll.status === 'sent' ? 'bg-green-100 text-green-800' : 
                        poll.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        poll.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {poll.status === 'sent' ? 'Sent' : 
                         poll.status === 'pending' ? 'Pending' : 
                         poll.status === 'failed' ? 'Failed' : 
                         'Unknown'}
                      </span>
                      
                      {poll.status === 'pending' && (
                        <button
                          onClick={() => deletePoll(poll.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                          title="Cancel Scheduled Poll"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {poll.status !== 'pending' && (
                        <button
                          onClick={() => deletePoll(poll.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                          title="Delete Poll"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPollBot;