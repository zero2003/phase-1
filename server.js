var express = require('express');
const cors = require('cors');
var app = express();
var http = require('http').Server(app);

app.use(cors());
app.use(express.static(__dirname + '/www'));
app.use(express.json());

const users = [
    {
      id: 1,
      username: 'super',
      email: 'super@example.com',
      password: '123',
      roles: ['super administrator', 'group administrator'],
      groups: []
    },
    {
      id: 2,
      username: 'john_doe',
      email: 'john.doe@example.com',
      password: 'password123',
      roles: ['chat user'],
      groups: [1,3,4]
    },
    {
      id: 3,
      username: 'jane_smith',
      email: 'jane.smith@example.com',
      password: 'password456',
      roles: ['group administrator'],
      groups: [4,5]
    },
  ];

  const groups = [
    { id: 1, name: 'general', administrators: [1], channels: ['General Discussion', 'Off-Topic'] },
    { id: 2, name: 'admins', administrators: [1], channels: ['Admin Announcements']},
    { id: 3, name: 'sports', administrators: [], channels: ['Football', 'Basketball']},
    { id: 4, name: 'music', administrators: [3], channels: ['Rock Music', 'Classical Music'], bannedUsers: {'Rock Music': [2]}},
    { id: 5, name: 'technology', administrators: [3], channels: ['Tech News', 'Programming'] }
  ];

let groupJoinRequests = [];

app.post('/api/request-join', (req, res) => {
  const { userId, groupId } = req.body;
  const existingRequest = groupJoinRequests.find(req => req.userId === userId && req.groupId === groupId);
  
  if (existingRequest) {
    return res.status(400).json({ message: 'You have already requested to join this group' });
  }

  groupJoinRequests.push({ userId, groupId });
  res.json({ message: 'Request to join group sent successfully' });
});

app.post('/api/respond-request', (req, res) => {
  const { userId, groupId, action } = req.body; // action should be 'accept' or 'reject'

  if (action === 'accept') {
    const user = users.find(u => u.id === userId);
    if (user) {
      user.groups.push(groupId);
    }
  }

  groupJoinRequests = groupJoinRequests.filter(req => !(req.userId === userId && req.groupId === groupId));

  res.json({ message: `Request has been ${action === 'accept' ? 'accepted' : 'rejected'}` });
});

// Route to get all users
app.get('/api/users', (req, res) => {
  res.json(users);
});

// Route to get all groups
app.get('/api/groups', (req, res) => {
  res.json(groups);
});

app.get('/api/groupjoinrequests', (req, res) => {
  res.json(groupJoinRequests);
});

// Sign-Up route
app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;

  // Check if the username or email already exists
  const existingUser = users.find(u => u.username === username || u.email === email);
  if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
  }

  // Create a new user
  const newUser = {
      id: Date.now(),  // Simple unique ID based on timestamp
      username,
      email,
      password,
      roles: ['chat user'],  // Default role for new sign-ups
      groups: []
  };

  users.push(newUser);
  const { password: _, ...userWithoutPassword } = newUser; // Exclude password from the response
  res.json(userWithoutPassword);
});

// Delete User Route
app.delete('/api/users/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  // Find the user index
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Remove user from users array
  const removedUser = users.splice(userIndex, 1)[0];

  // Remove the user's ID from the administrators array in groups
  groups.forEach(group => {
    const adminIndex = group.administrators.indexOf(userId);
    if (adminIndex !== -1) {
      group.administrators.splice(adminIndex, 1);
    }
  });

  res.json({ message: 'User deleted successfully', user: removedUser });
});

  
  

// Login route
app.post('/api/auth', (req, res) => {
    const { email, password } = req.body;
    console.log('Received email:', email);
    console.log('Received password:', password);

    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        const { password, ...userWithoutPassword } = user; // Exclude password from the response
        res.json({ ...userWithoutPassword, valid: true });
    } else {
        console.log('Authentication failed. Invalid credentials.');
        res.status(401).json({ message: 'Invalid credentials', valid: false });
    }
});

// Leave group route
app.post('/api/leave-group', (req, res) => {
  const { userId, groupId } = req.body;
  
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Remove the group from the user's group list
  user.groups = user.groups.filter(id => id !== groupId);
  
  // If the user was an administrator of the group, remove them from the administrators array
  const group = groups.find(g => g.id === groupId);
  if (group && group.administrators.includes(userId)) {
    group.administrators = group.administrators.filter(id => id !== userId);
  }

  res.json({ message: 'Left group successfully' });
});

//Create group route
app.post('/api/groups', (req, res) => {
  const { groupName, userId } = req.body;

  // Find the user to ensure they are a group administrator
  const user = users.find(u => u.id === userId);


  // Create the new group
  const newGroup = {
    id: groups.length + 1, // Generate a new ID based on the current number of groups
    name: groupName,
    administrators: [userId],
    channels: [] // No channels initially
  };

  // Add the new group to the groups array
  groups.push(newGroup);

  if (user) {
    user.groups.push(newGroup.id);
  }

  res.json(newGroup);
});

// Create channel route
app.post('/api/groups/:groupId/channels', (req, res) => {
  const { groupId } = req.params;
  const { channelName } = req.body;

  const group = groups.find(g => g.id === parseInt(groupId));;

  if (!group) {
    return res.status(404).json({ message: 'Group not found' });
  }

  // Add the new channel to the group's channels array
  group.channels.push(channelName);

  res.json({ message: 'Channel added successfully', channels: group.channels });
});

// Remove channel route
app.delete('/api/groups/:groupId/channels/:channelName', (req, res) => {
  const { groupId, channelName } = req.params;

  const group = groups.find(g => g.id === parseInt(groupId));

  if (!group) {
    return res.status(404).json({ message: 'Group not found' });
  }

  group.channels = group.channels.filter(channel => channel !== channelName);

  res.json({ message: 'Channel removed successfully', channels: group.channels });
});

// Remove user from group route
app.post('/api/groups/:groupId/remove-user', (req, res) => {
  const { groupId } = req.params;
  const { targetUserId } = req.body; // targetUserId is the ID of the user to be removed

  const group = groups.find(g => g.id === parseInt(groupId));
  const targetUser = users.find(u => u.id === targetUserId);

  if (!group) {
    return res.status(404).json({ message: 'Group not found' });
  }

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Remove the group from the target user's group list
  targetUser.groups = targetUser.groups.filter(id => id !== parseInt(groupId));

  if (group.administrators.includes(targetUserId)) {
    group.administrators = group.administrators.filter(id => id !== targetUserId);
  }

  res.json({ message: 'User removed from group successfully', groups: targetUser.groups });
});

// Remove group route
app.delete('/api/groups/:groupId', (req, res) => {
  const { groupId } = req.params;

  const groupIndex = groups.findIndex(g => g.id === parseInt(groupId));

  if (groupIndex === -1) {
    return res.status(404).json({ message: 'Group not found' });
  }

  groups.splice(groupIndex, 1);

  res.json({ message: 'Group removed successfully' });
});

//Ban user route
app.post('/api/groups/:groupId/ban-user', (req, res) => {
  const { groupId } = req.params;
  const { channelName, userId } = req.body;

  const group = groups.find(g => g.id === parseInt(groupId));
  if (!group) {
    return res.status(404).json({ message: 'Group not found' });
  }

  if (!group.bannedUsers) {
    group.bannedUsers = {};
  }

  if (!group.bannedUsers[channelName]) {
    group.bannedUsers[channelName] = [];
  }

  group.bannedUsers[channelName].push(userId);

  res.json({ message: `User ${userId} banned from channel ${channelName}` });
});

//Promote group admin route
app.post('/api/users/:userId/promote-group-admin', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { groupId } = req.body;

  // Find the user and group
  const user = users.find(u => u.id === userId);
  const group = groups.find(g => g.id === groupId);

  if (!user || !group) {
    return res.status(404).json({ message: 'User or Group not found' });
  }

  // Add the 'group administrator' role to the user's roles
  if (!user.roles.includes('group administrator')) {
    user.roles.push('group administrator');
  }

  // Add the user to the group's administrators list
  if (!group.administrators.includes(userId)) {
    group.administrators.push(userId);
  }

  res.json({ message: 'User promoted to Group Admin successfully', group });
});


//Promote super admin route
app.post('/api/users/:userId/promote-super-admin', (req, res) => {
  const { userId } = req.params;
  const user = users.find(u => u.id === parseInt(userId));
  if (user) {
    if (!user.roles.includes('super administrator')) {
      user.roles.push('super administrator');
      res.json({ message: 'User promoted to Super Admin successfully' });
    } else {
      res.status(400).json({ message: 'User is already a Super Admin' });
    }
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});



let server = http.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;
    console.log("My First Nodejs Server!");
    console.log("Server listening on: "+ host + " port: " + port);
});