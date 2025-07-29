
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAEFnSKxmuxZ3JKHacGn3iMzps6yuwCS0E",
    authDomain: "campus-boost-7d7ac.firebaseapp.com",
    projectId: "campus-boost-7d7ac",
    storageBucket: "campus-boost-7d7ac.firebasestorage.app",
    messagingSenderId: "755100429989",
    appId: "1:755100429989:web:d6abbff0dd0f5b24abe74c",
    measurementId: "G-333LVQX0KZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userIsPremium = false;
let timerInterval = null;
let pomodoroInterval = null;
let stopwatchInterval = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user);
        checkPremiumStatus();
    } else {
        window.location.href = 'register.html';
    }
});

// Load user data from Firestore
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('dashboardUserName').textContent = userData.fullName || 'Student';
            
            // Check premium status - include trial users as premium
            const premiumExpiry = userData.premiumExpiry?.toDate();
            const now = new Date();
            const isPaidPremium = premiumExpiry && premiumExpiry > now;
            
            // Calculate trial period - exactly 30 days from account creation
            const accountCreated = userData.createdAt?.toDate() || userData.registeredAt?.toDate();
            const trialEnd = accountCreated ? new Date(accountCreated.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;
            const isTrialActive = trialEnd && now < trialEnd;
            
            // User is premium if they have paid subscription OR active trial
            userIsPremium = isPaidPremium || (userData.isTrialUser && isTrialActive);
            
            // Set default stats to 0
            document.getElementById('currentCGPA').textContent = '0.00';
            document.getElementById('studyHours').textContent = '0';
            document.getElementById('itemsSold').textContent = '0';
            document.getElementById('totalEarnings').textContent = '₦0';
            
            if (userIsPremium) {
                document.getElementById('premiumBadge').classList.remove('d-none');
                
                // Show trial alert for trial users
                if (userData.isTrialUser && !isPaidPremium) {
                    if (isTrialActive && trialEnd) {
                        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                        document.getElementById('premiumAlert').classList.remove('d-none');
                        document.getElementById('trialDays').textContent = daysLeft + ' days';
                    } else {
                        // Trial expired - show upgrade message
                        document.getElementById('premiumAlert').classList.remove('d-none');
                        document.getElementById('premiumAlert').className = 'alert alert-warning d-block';
                        document.getElementById('premiumAlert').innerHTML = `
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>⏰ Trial Expired!</strong> 
                                    Your 30-day free trial has ended. Upgrade to continue using premium features.
                                </div>
                                <button class="btn btn-warning btn-sm" onclick="showPayment()">Upgrade Now</button>
                            </div>
                        `;
                    }
                }
            }
            
            updatePremiumFeatures();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Check and update premium status
function checkPremiumStatus() {
    const premiumFeatures = document.querySelectorAll('.premium-feature');
    const premiumSections = document.querySelectorAll('.premium-section');
    
    // Only restrict features if user is not premium (includes expired trial)
    premiumFeatures.forEach(element => {
        // Remove any existing lock icons first
        element.innerHTML = element.innerHTML.replace(' 🔒', '');
        
        if (!userIsPremium) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                showPayment();
            });
            element.innerHTML += ' 🔒';
            element.classList.add('text-muted');
            element.style.opacity = '0.6';
        } else {
            element.classList.remove('text-muted');
            element.style.opacity = '1';
        }
    });
}

// Update UI based on premium status
function updatePremiumFeatures() {
    if (!userIsPremium) {
        const premiumFeatures = document.querySelectorAll('.premium-feature');
        premiumFeatures.forEach(element => {
            element.classList.add('text-muted');
            element.style.opacity = '0.6';
        });
    }
}

// Navigation functions
window.showSection = function(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.add('d-none'));
    
    // Show selected section
    document.getElementById(sectionId).classList.remove('d-none');
    
    // Update nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');
    
    // Block access to premium sections if user is not premium (includes expired trial)
    if (!userIsPremium && document.getElementById(sectionId).classList.contains('premium-section')) {
        showPayment();
        // Show overview instead
        document.getElementById('overview').classList.remove('d-none');
        document.getElementById(sectionId).classList.add('d-none');
        return;
    }
};

// CGPA Calculator Functions
window.addSubject = function() {
    const container = document.getElementById('subjectsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'subject-row row mb-3';
    newRow.innerHTML = `
        <div class="col-md-4">
            <input type="text" class="form-control" placeholder="Subject Name">
        </div>
        <div class="col-md-3">
            <input type="number" class="form-control" placeholder="Credit Units" min="1" max="6">
        </div>
        <div class="col-md-3">
            <select class="form-control">
                <option value="">Select Grade</option>
                <option value="5">A (5.0)</option>
                <option value="4">B (4.0)</option>
                <option value="3">C (3.0)</option>
                <option value="2">D (2.0)</option>
                <option value="1">E (1.0)</option>
                <option value="0">F (0.0)</option>
            </select>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-danger" onclick="removeSubject(this)">×</button>
        </div>
    `;
    container.appendChild(newRow);
};

window.removeSubject = function(button) {
    button.closest('.subject-row').remove();
};

window.calculateCGPA = function() {
    const rows = document.querySelectorAll('.subject-row');
    let totalPoints = 0;
    let totalUnits = 0;
    
    rows.forEach(row => {
        const units = parseInt(row.querySelector('input[type="number"]').value) || 0;
        const grade = parseFloat(row.querySelector('select').value) || 0;
        
        if (units > 0 && grade >= 0) {
            totalPoints += units * grade;
            totalUnits += units;
        }
    });
    
    const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
    document.getElementById('cgpaResult').textContent = cgpa;
    document.getElementById('currentCGPA').textContent = cgpa;
};

// Study Planner Functions
document.getElementById('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskName = document.getElementById('taskName').value;
    const taskSubject = document.getElementById('taskSubject').value;
    const taskDate = document.getElementById('taskDate').value;
    const taskPriority = document.getElementById('taskPriority').value;
    
    try {
        await addDoc(collection(db, 'tasks'), {
            userId: currentUser.uid,
            name: taskName,
            subject: taskSubject,
            dueDate: new Date(taskDate),
            priority: taskPriority,
            completed: false,
            createdAt: new Date()
        });
        
        // Reset form
        document.getElementById('taskForm').reset();
        loadTasks();
    } catch (error) {
        console.error('Error adding task:', error);
    }
});

async function loadTasks() {
    if (!currentUser) return;
    
    const tasksQuery = query(
        collection(db, 'tasks'),
        orderBy('dueDate', 'asc')
    );
    
    onSnapshot(tasksQuery, (snapshot) => {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        tasksList.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const task = doc.data();
            if (task.userId === currentUser.uid) {
                const taskElement = document.createElement('div');
                taskElement.className = 'task-item d-flex justify-content-between align-items-center py-2 border-bottom';
                
                const priorityColors = {
                    'high': 'danger',
                    'medium': 'warning',
                    'low': 'success'
                };
                
                taskElement.innerHTML = `
                    <div>
                        <strong>${task.name}</strong>
                        <div class="text-muted small">${task.subject} - Due: ${task.dueDate.toDate().toLocaleDateString()}</div>
                    </div>
                    <div>
                        <span class="badge bg-${priorityColors[task.priority]}">${task.priority.toUpperCase()}</span>
                        <button class="btn btn-sm btn-outline-success ms-2" onclick="completeTask('${doc.id}')">✓</button>
                    </div>
                `;
                tasksList.appendChild(taskElement);
            }
        });
    });
}

// Timer Functions
window.startTimer = function() {
    const minutes = parseInt(document.getElementById('timerMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('timerSeconds').value) || 0;
    let totalSeconds = (minutes * 60) + seconds;
    
    if (totalSeconds <= 0) {
        alert('Please enter a valid time');
        return;
    }
    
    document.getElementById('timerStart').disabled = true;
    document.getElementById('timerStop').disabled = false;
    document.getElementById('timerReset').disabled = false;
    
    timerInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            document.getElementById('timerDisplay').textContent = '00:00';
            document.getElementById('timerStart').disabled = false;
            document.getElementById('timerStop').disabled = true;
            alert('⏰ Timer finished!');
            return;
        }
        
        totalSeconds--;
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        document.getElementById('timerDisplay').textContent = 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
};

window.stopTimer = function() {
    clearInterval(timerInterval);
    document.getElementById('timerStart').disabled = false;
    document.getElementById('timerStop').disabled = true;
};

window.resetTimer = function() {
    clearInterval(timerInterval);
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('timerStart').disabled = false;
    document.getElementById('timerStop').disabled = true;
    document.getElementById('timerReset').disabled = true;
    document.getElementById('timerMinutes').value = '';
    document.getElementById('timerSeconds').value = '';
};

// Pomodoro Timer Functions
let pomodoroState = 'work'; // 'work', 'shortBreak', 'longBreak'
let pomodoroSession = 0;

window.startPomodoro = function() {
    const workMinutes = 25;
    const shortBreakMinutes = 5;
    const longBreakMinutes = 15;
    
    let totalSeconds;
    
    if (pomodoroState === 'work') {
        totalSeconds = workMinutes * 60;
        document.getElementById('pomodoroStatus').textContent = 'Work Session';
    } else if (pomodoroState === 'shortBreak') {
        totalSeconds = shortBreakMinutes * 60;
        document.getElementById('pomodoroStatus').textContent = 'Short Break';
    } else {
        totalSeconds = longBreakMinutes * 60;
        document.getElementById('pomodoroStatus').textContent = 'Long Break';
    }
    
    document.getElementById('pomodoroStart').disabled = true;
    document.getElementById('pomodoroStop').disabled = false;
    
    pomodoroInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(pomodoroInterval);
            document.getElementById('pomodoroStart').disabled = false;
            document.getElementById('pomodoroStop').disabled = true;
            
            if (pomodoroState === 'work') {
                pomodoroSession++;
                document.getElementById('pomodoroSessions').textContent = pomodoroSession;
                
                if (pomodoroSession % 4 === 0) {
                    pomodoroState = 'longBreak';
                    alert('🎉 Work session complete! Time for a long break (15 min)');
                } else {
                    pomodoroState = 'shortBreak';
                    alert('✅ Work session complete! Time for a short break (5 min)');
                }
            } else {
                pomodoroState = 'work';
                alert('⚡ Break over! Ready for another work session?');
            }
            
            return;
        }
        
        totalSeconds--;
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        document.getElementById('pomodoroDisplay').textContent = 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
};

window.stopPomodoro = function() {
    clearInterval(pomodoroInterval);
    document.getElementById('pomodoroStart').disabled = false;
    document.getElementById('pomodoroStop').disabled = true;
};

window.resetPomodoro = function() {
    clearInterval(pomodoroInterval);
    pomodoroState = 'work';
    pomodoroSession = 0;
    document.getElementById('pomodoroDisplay').textContent = '25:00';
    document.getElementById('pomodoroStatus').textContent = 'Ready to Start';
    document.getElementById('pomodoroSessions').textContent = '0';
    document.getElementById('pomodoroStart').disabled = false;
    document.getElementById('pomodoroStop').disabled = true;
};

// Stopwatch Functions
let stopwatchTime = 0;

window.startStopwatch = function() {
    document.getElementById('stopwatchStart').disabled = true;
    document.getElementById('stopwatchStop').disabled = false;
    
    stopwatchInterval = setInterval(() => {
        stopwatchTime++;
        const hours = Math.floor(stopwatchTime / 3600);
        const minutes = Math.floor((stopwatchTime % 3600) / 60);
        const seconds = stopwatchTime % 60;
        
        document.getElementById('stopwatchDisplay').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
};

window.stopStopwatch = function() {
    clearInterval(stopwatchInterval);
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;
};

window.resetStopwatch = function() {
    clearInterval(stopwatchInterval);
    stopwatchTime = 0;
    document.getElementById('stopwatchDisplay').textContent = '00:00:00';
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;
};

// To-Do List Functions
let todos = JSON.parse(localStorage.getItem('campusBoostTodos')) || [];

function saveTodos() {
    localStorage.setItem('campusBoostTodos', JSON.stringify(todos));
}

window.addTodo = function() {
    const todoInput = document.getElementById('todoInput');
    const todoText = todoInput.value.trim();
    
    if (todoText === '') return;
    
    const todo = {
        id: Date.now(),
        text: todoText,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    todos.unshift(todo);
    todoInput.value = '';
    saveTodos();
    renderTodos();
};

window.toggleTodo = function(id) {
    todos = todos.map(todo => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    saveTodos();
    renderTodos();
};

window.deleteTodo = function(id) {
    todos = todos.filter(todo => todo.id !== id);
    saveTodos();
    renderTodos();
};

function renderTodos() {
    const todoList = document.getElementById('todoList');
    if (!todoList) return;
    
    todoList.innerHTML = '';
    
    todos.forEach(todo => {
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item d-flex justify-content-between align-items-center py-2 border-bottom';
        todoItem.innerHTML = `
            <div class="d-flex align-items-center">
                <input type="checkbox" class="form-check-input me-2" ${todo.completed ? 'checked' : ''} 
                       onchange="toggleTodo(${todo.id})">
                <span class="${todo.completed ? 'text-decoration-line-through text-muted' : ''}">${todo.text}</span>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTodo(${todo.id})">×</button>
        `;
        todoList.appendChild(todoItem);
    });
    
    // Update counter
    const completed = todos.filter(todo => todo.completed).length;
    const total = todos.length;
    if (document.getElementById('todoCounter')) {
        document.getElementById('todoCounter').textContent = `${completed}/${total} completed`;
    }
}

// Unit Converter Functions
const conversions = {
    length: {
        meter: 1,
        kilometer: 0.001,
        centimeter: 100,
        millimeter: 1000,
        inch: 39.3701,
        foot: 3.28084,
        yard: 1.09361,
        mile: 0.000621371
    },
    weight: {
        kilogram: 1,
        gram: 1000,
        pound: 2.20462,
        ounce: 35.274,
        ton: 0.001
    },
    temperature: {
        celsius: (c) => ({ celsius: c, fahrenheit: (c * 9/5) + 32, kelvin: c + 273.15 }),
        fahrenheit: (f) => ({ celsius: (f - 32) * 5/9, fahrenheit: f, kelvin: ((f - 32) * 5/9) + 273.15 }),
        kelvin: (k) => ({ celsius: k - 273.15, fahrenheit: ((k - 273.15) * 9/5) + 32, kelvin: k })
    }
};

window.convertUnit = function() {
    const value = parseFloat(document.getElementById('converterValue').value);
    const category = document.getElementById('converterCategory').value;
    const fromUnit = document.getElementById('converterFrom').value;
    const toUnit = document.getElementById('converterTo').value;
    
    if (isNaN(value) || !category || !fromUnit || !toUnit) {
        document.getElementById('converterResult').textContent = 'Please fill all fields';
        return;
    }
    
    let result;
    
    if (category === 'temperature') {
        const converted = conversions.temperature[fromUnit](value);
        result = converted[toUnit].toFixed(2);
    } else {
        const baseValue = value / conversions[category][fromUnit];
        result = (baseValue * conversions[category][toUnit]).toFixed(4);
    }
    
    document.getElementById('converterResult').textContent = 
        `${value} ${fromUnit} = ${result} ${toUnit}`;
};

window.updateConverterUnits = function() {
    const category = document.getElementById('converterCategory').value;
    const fromSelect = document.getElementById('converterFrom');
    const toSelect = document.getElementById('converterTo');
    
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    if (category && conversions[category]) {
        Object.keys(conversions[category]).forEach(unit => {
            if (category !== 'temperature' || typeof conversions[category][unit] === 'function') {
                fromSelect.innerHTML += `<option value="${unit}">${unit}</option>`;
                toSelect.innerHTML += `<option value="${unit}">${unit}</option>`;
            }
        });
    }
};

// Flashcard Functions
let flashcards = JSON.parse(localStorage.getItem('campusBoostFlashcards')) || [];
let currentFlashcard = 0;
let showingAnswer = false;

function saveFlashcards() {
    localStorage.setItem('campusBoostFlashcards', JSON.stringify(flashcards));
}

window.addFlashcard = function() {
    const question = document.getElementById('flashcardQuestion').value.trim();
    const answer = document.getElementById('flashcardAnswer').value.trim();
    
    if (question === '' || answer === '') {
        alert('Please enter both question and answer');
        return;
    }
    
    flashcards.push({
        id: Date.now(),
        question: question,
        answer: answer,
        createdAt: new Date().toISOString()
    });
    
    document.getElementById('flashcardQuestion').value = '';
    document.getElementById('flashcardAnswer').value = '';
    saveFlashcards();
    renderFlashcardList();
    updateFlashcardDisplay();
};

window.deleteFlashcard = function(id) {
    flashcards = flashcards.filter(card => card.id !== id);
    saveFlashcards();
    renderFlashcardList();
    updateFlashcardDisplay();
};

window.startFlashcardSession = function() {
    if (flashcards.length === 0) {
        alert('Please add some flashcards first!');
        return;
    }
    
    currentFlashcard = 0;
    showingAnswer = false;
    document.getElementById('flashcardViewer').classList.remove('d-none');
    updateFlashcardDisplay();
};

window.flipFlashcard = function() {
    showingAnswer = !showingAnswer;
    updateFlashcardDisplay();
};

window.nextFlashcard = function() {
    currentFlashcard = (currentFlashcard + 1) % flashcards.length;
    showingAnswer = false;
    updateFlashcardDisplay();
};

window.prevFlashcard = function() {
    currentFlashcard = currentFlashcard === 0 ? flashcards.length - 1 : currentFlashcard - 1;
    showingAnswer = false;
    updateFlashcardDisplay();
};

function updateFlashcardDisplay() {
    if (flashcards.length === 0) {
        document.getElementById('flashcardContent').innerHTML = '<p class="text-center text-muted">No flashcards available</p>';
        return;
    }
    
    const card = flashcards[currentFlashcard];
    const content = showingAnswer ? card.answer : card.question;
    const label = showingAnswer ? 'Answer' : 'Question';
    
    document.getElementById('flashcardContent').innerHTML = `
        <div class="text-center">
            <div class="badge bg-primary mb-3">${label}</div>
            <h4>${content}</h4>
            <div class="mt-3 text-muted small">Card ${currentFlashcard + 1} of ${flashcards.length}</div>
        </div>
    `;
}

function renderFlashcardList() {
    const flashcardList = document.getElementById('flashcardList');
    if (!flashcardList) return;
    
    flashcardList.innerHTML = '';
    
    flashcards.forEach(card => {
        const cardItem = document.createElement('div');
        cardItem.className = 'card mb-2';
        cardItem.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="card-title">${card.question}</h6>
                        <p class="card-text text-muted small">${card.answer}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteFlashcard(${card.id})">×</button>
                </div>
            </div>
        `;
        flashcardList.appendChild(cardItem);
    });
}

// Notes Functions
window.saveNote = function() {
    const noteContent = document.getElementById('noteEditor').value;
    const noteTitle = document.getElementById('noteTitle').value || 'Untitled Note';
    
    localStorage.setItem('campusBoostNote', JSON.stringify({
        title: noteTitle,
        content: noteContent,
        lastSaved: new Date().toISOString()
    }));
    
    alert('Note saved successfully!');
    updateLastSaved();
};

window.loadNote = function() {
    const saved = localStorage.getItem('campusBoostNote');
    if (saved) {
        const note = JSON.parse(saved);
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteEditor').value = note.content;
        updateLastSaved();
    }
};

window.clearNote = function() {
    if (confirm('Are you sure you want to clear the note?')) {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteEditor').value = '';
        localStorage.removeItem('campusBoostNote');
    }
};

window.exportNote = function() {
    const title = document.getElementById('noteTitle').value || 'note';
    const content = document.getElementById('noteEditor').value;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

function updateLastSaved() {
    const saved = localStorage.getItem('campusBoostNote');
    if (saved) {
        const note = JSON.parse(saved);
        const lastSaved = new Date(note.lastSaved).toLocaleString();
        document.getElementById('noteLastSaved').textContent = `Last saved: ${lastSaved}`;
    }
}

// Dictionary Functions
const dictionary = {
    "academic": "relating to education and scholarship",
    "algorithm": "a process or set of rules to be followed in calculations",
    "analysis": "detailed examination of the elements or structure of something",
    "bibliography": "a list of books referred to in a scholarly work",
    "calculate": "determine the amount or number of something mathematically",
    "data": "facts and statistics collected together for reference or analysis",
    "education": "the process of receiving or giving systematic instruction",
    "framework": "an essential supporting structure of a building, vehicle, or object",
    "generate": "cause something to arise or come about",
    "hypothesis": "a supposition or proposed explanation made on the basis of limited evidence",
    "implement": "put a decision or plan into effect",
    "justify": "show or prove to be right or reasonable",
    "knowledge": "facts, information, and skills acquired through experience or education",
    "methodology": "a system of methods used in a particular area of study",
    "objective": "a thing aimed at or sought; a goal",
    "parameter": "a numerical or other measurable factor forming one of a set",
    "quantify": "express or measure the quantity of",
    "research": "the systematic investigation into and study of materials and sources",
    "synthesize": "combine a number of things into a coherent whole",
    "theory": "a supposition or a system of ideas intended to explain something"
};

window.searchDictionary = function() {
    const word = document.getElementById('dictionarySearch').value.toLowerCase().trim();
    const resultDiv = document.getElementById('dictionaryResult');
    
    if (word === '') {
        resultDiv.innerHTML = '<p class="text-muted">Enter a word to search</p>';
        return;
    }
    
    if (dictionary[word]) {
        resultDiv.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title text-primary">${word}</h5>
                    <p class="card-text">${dictionary[word]}</p>
                </div>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>${word}</strong> not found in dictionary. Try another word.
            </div>
        `;
    }
};

// Scientific Calculator Functions
let calcDisplay = '0';
let calcOperator = null;
let calcWaitingForNewNumber = false;
let calcPreviousNumber = null;

window.calcInput = function(value) {
    if (calcWaitingForNewNumber && !isNaN(value)) {
        calcDisplay = value;
        calcWaitingForNewNumber = false;
    } else {
        calcDisplay = calcDisplay === '0' ? value : calcDisplay + value;
    }
    updateCalcDisplay();
};

window.calcOperation = function(nextOperator) {
    const inputValue = parseFloat(calcDisplay);
    
    if (calcPreviousNumber === null) {
        calcPreviousNumber = inputValue;
    } else if (calcOperator) {
        const currentValue = calcPreviousNumber || 0;
        const newValue = calcCalculate(currentValue, inputValue, calcOperator);
        
        calcDisplay = String(newValue);
        calcPreviousNumber = newValue;
    }
    
    calcWaitingForNewNumber = true;
    calcOperator = nextOperator;
    updateCalcDisplay();
};

window.calcEquals = function() {
    const inputValue = parseFloat(calcDisplay);
    
    if (calcPreviousNumber !== null && calcOperator) {
        const newValue = calcCalculate(calcPreviousNumber, inputValue, calcOperator);
        calcDisplay = String(newValue);
        calcPreviousNumber = null;
        calcOperator = null;
        calcWaitingForNewNumber = true;
    }
    updateCalcDisplay();
};

window.calcClear = function() {
    calcDisplay = '0';
    calcOperator = null;
    calcPreviousNumber = null;
    calcWaitingForNewNumber = false;
    updateCalcDisplay();
};

window.calcScientific = function(func) {
    const value = parseFloat(calcDisplay);
    let result;
    
    switch(func) {
        case 'sin':
            result = Math.sin(value * Math.PI / 180);
            break;
        case 'cos':
            result = Math.cos(value * Math.PI / 180);
            break;
        case 'tan':
            result = Math.tan(value * Math.PI / 180);
            break;
        case 'log':
            result = Math.log10(value);
            break;
        case 'ln':
            result = Math.log(value);
            break;
        case 'sqrt':
            result = Math.sqrt(value);
            break;
        case 'square':
            result = value * value;
            break;
        case 'pi':
            result = Math.PI;
            break;
        case 'e':
            result = Math.E;
            break;
        default:
            return;
    }
    
    calcDisplay = String(result);
    calcWaitingForNewNumber = true;
    updateCalcDisplay();
};

function calcCalculate(firstNumber, secondNumber, operator) {
    switch (operator) {
        case '+':
            return firstNumber + secondNumber;
        case '-':
            return firstNumber - secondNumber;
        case '*':
            return firstNumber * secondNumber;
        case '/':
            return firstNumber / secondNumber;
        case '^':
            return Math.pow(firstNumber, secondNumber);
        default:
            return secondNumber;
    }
}

function updateCalcDisplay() {
    document.getElementById('calcDisplay').textContent = calcDisplay;
}

// Goal Tracker Functions
let goals = JSON.parse(localStorage.getItem('campusBoostGoals')) || [];

function saveGoals() {
    localStorage.setItem('campusBoostGoals', JSON.stringify(goals));
}

window.addGoal = function() {
    const goalTitle = document.getElementById('goalTitle').value.trim();
    const goalTarget = parseInt(document.getElementById('goalTarget').value) || 1;
    const goalDeadline = document.getElementById('goalDeadline').value;
    
    if (goalTitle === '') return;
    
    const goal = {
        id: Date.now(),
        title: goalTitle,
        target: goalTarget,
        current: 0,
        deadline: goalDeadline,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    goals.unshift(goal);
    document.getElementById('goalTitle').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalDeadline').value = '';
    saveGoals();
    renderGoals();
};

window.updateGoalProgress = function(id, progress) {
    goals = goals.map(goal => {
        if (goal.id === id) {
            const newCurrent = Math.max(0, Math.min(goal.target, progress));
            return { ...goal, current: newCurrent, completed: newCurrent >= goal.target };
        }
        return goal;
    });
    saveGoals();
    renderGoals();
};

window.deleteGoal = function(id) {
    goals = goals.filter(goal => goal.id !== id);
    saveGoals();
    renderGoals();
};

function renderGoals() {
    const goalsList = document.getElementById('goalsList');
    if (!goalsList) return;
    
    goalsList.innerHTML = '';
    
    goals.forEach(goal => {
        const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        const goalItem = document.createElement('div');
        goalItem.className = 'card mb-3';
        goalItem.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title ${goal.completed ? 'text-success' : ''}">${goal.title} ${goal.completed ? '✅' : ''}</h6>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal(${goal.id})">×</button>
                </div>
                <div class="progress mb-2" style="height: 8px;">
                    <div class="progress-bar ${goal.completed ? 'bg-success' : 'bg-primary'}" 
                         style="width: ${progress}%"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${goal.current}/${goal.target} ${daysLeft !== null ? `• ${daysLeft} days left` : ''}</small>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary" onclick="updateGoalProgress(${goal.id}, ${goal.current + 1})">+1</button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="updateGoalProgress(${goal.id}, ${goal.current - 1})">-1</button>
                    </div>
                </div>
            </div>
        `;
        goalsList.appendChild(goalItem);
    });
}

// Habit Tracker Functions
let habits = JSON.parse(localStorage.getItem('campusBoostHabits')) || [];

function saveHabits() {
    localStorage.setItem('campusBoostHabits', JSON.stringify(habits));
}

window.addHabit = function() {
    const habitName = document.getElementById('habitName').value.trim();
    const habitFrequency = document.getElementById('habitFrequency').value;
    
    if (habitName === '') return;
    
    const habit = {
        id: Date.now(),
        name: habitName,
        frequency: habitFrequency,
        completions: [],
        createdAt: new Date().toISOString()
    };
    
    habits.unshift(habit);
    document.getElementById('habitName').value = '';
    saveHabits();
    renderHabits();
};

window.toggleHabitToday = function(id) {
    const today = new Date().toDateString();
    
    habits = habits.map(habit => {
        if (habit.id === id) {
            const completions = habit.completions || [];
            const todayIndex = completions.indexOf(today);
            
            if (todayIndex > -1) {
                completions.splice(todayIndex, 1);
            } else {
                completions.push(today);
            }
            
            return { ...habit, completions };
        }
        return habit;
    });
    
    saveHabits();
    renderHabits();
};

window.deleteHabit = function(id) {
    habits = habits.filter(habit => habit.id !== id);
    saveHabits();
    renderHabits();
};

function renderHabits() {
    const habitsList = document.getElementById('habitsList');
    if (!habitsList) return;
    
    habitsList.innerHTML = '';
    
    habits.forEach(habit => {
        const today = new Date().toDateString();
        const completions = habit.completions || [];
        const completedToday = completions.includes(today);
        const streak = calculateStreak(completions);
        
        const habitItem = document.createElement('div');
        habitItem.className = 'card mb-3';
        habitItem.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title">${habit.name}</h6>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteHabit(${habit.id})">×</button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-secondary">${habit.frequency}</span>
                        <span class="badge bg-warning ms-1">🔥 ${streak} day streak</span>
                    </div>
                    <button class="btn btn-sm ${completedToday ? 'btn-success' : 'btn-outline-primary'}" 
                            onclick="toggleHabitToday(${habit.id})">
                        ${completedToday ? '✅ Done Today' : '⭕ Mark Done'}
                    </button>
                </div>
            </div>
        `;
        habitsList.appendChild(habitItem);
    });
}

function calculateStreak(completions) {
    if (!completions || completions.length === 0) return 0;
    
    const sortedDates = completions.map(date => new Date(date)).sort((a, b) => b - a);
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedDates.length; i++) {
        const completionDate = new Date(sortedDates[i]);
        completionDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((currentDate - completionDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

// Vocabulary Builder Functions
const vocabularyWords = [
    { word: "abundant", meaning: "existing or available in large quantities; plentiful", difficulty: "intermediate" },
    { word: "benevolent", meaning: "well meaning and kindly", difficulty: "advanced" },
    { word: "cognitive", meaning: "relating to thinking or conscious mental processes", difficulty: "advanced" },
    { word: "diligent", meaning: "having or showing care and conscientiousness", difficulty: "intermediate" },
    { word: "eloquent", meaning: "fluent or persuasive in speaking or writing", difficulty: "advanced" },
    { word: "fundamental", meaning: "forming a necessary base or core", difficulty: "intermediate" },
    { word: "gregarious", meaning: "fond of the company of others; sociable", difficulty: "advanced" },
    { word: "hypothesis", meaning: "a supposition made as a starting point for investigation", difficulty: "intermediate" },
    { word: "illuminate", meaning: "light up or brighten with light", difficulty: "intermediate" },
    { word: "judicious", meaning: "having, showing, or done with good judgment", difficulty: "advanced" }
];

let currentVocabWord = 0;
let vocabProgress = JSON.parse(localStorage.getItem('campusBoostVocabProgress')) || {};

function saveVocabProgress() {
    localStorage.setItem('campusBoostVocabProgress', JSON.stringify(vocabProgress));
}

window.showVocabWord = function() {
    if (vocabularyWords.length === 0) return;
    
    const word = vocabularyWords[currentVocabWord];
    document.getElementById('vocabWord').textContent = word.word;
    document.getElementById('vocabMeaning').textContent = word.meaning;
    document.getElementById('vocabDifficulty').textContent = word.difficulty;
    document.getElementById('vocabCounter').textContent = `${currentVocabWord + 1} of ${vocabularyWords.length}`;
    
    // Update button states
    const isKnown = vocabProgress[word.word] === 'known';
    const isLearning = vocabProgress[word.word] === 'learning';
    
    document.getElementById('vocabKnown').className = isKnown ? 'btn btn-success' : 'btn btn-outline-success';
    document.getElementById('vocabLearning').className = isLearning ? 'btn btn-warning' : 'btn btn-outline-warning';
};

window.nextVocabWord = function() {
    currentVocabWord = (currentVocabWord + 1) % vocabularyWords.length;
    showVocabWord();
};

window.prevVocabWord = function() {
    currentVocabWord = currentVocabWord === 0 ? vocabularyWords.length - 1 : currentVocabWord - 1;
    showVocabWord();
};

window.markVocabKnown = function() {
    const word = vocabularyWords[currentVocabWord].word;
    vocabProgress[word] = 'known';
    saveVocabProgress();
    showVocabWord();
    updateVocabStats();
};

window.markVocabLearning = function() {
    const word = vocabularyWords[currentVocabWord].word;
    vocabProgress[word] = 'learning';
    saveVocabProgress();
    showVocabWord();
    updateVocabStats();
};

function updateVocabStats() {
    const known = Object.values(vocabProgress).filter(status => status === 'known').length;
    const learning = Object.values(vocabProgress).filter(status => status === 'learning').length;
    const total = vocabularyWords.length;
    
    if (document.getElementById('vocabStats')) {
        document.getElementById('vocabStats').innerHTML = `
            <div class="row text-center">
                <div class="col-4">
                    <div class="h4 text-success">${known}</div>
                    <small>Known</small>
                </div>
                <div class="col-4">
                    <div class="h4 text-warning">${learning}</div>
                    <small>Learning</small>
                </div>
                <div class="col-4">
                    <div class="h4 text-muted">${total - known - learning}</div>
                    <small>New</small>
                </div>
            </div>
        `;
    }
}

// Payment Functions
window.showPayment = function() {
    const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    modal.show();
};

window.processPayment = function() {
    FlutterwaveCheckout({
        public_key: "FLWPUBK_TEST-465e3825b7841beb379d071ed70c4054-X",
        tx_ref: "CB-" + Date.now(),
        amount: 500,
        currency: "NGN",
        country: "NG",
        payment_options: "card,mobilemoney,ussd",
        customer: {
            email: currentUser.email,
            phone_number: "08086556841",
            name: currentUser.displayName,
        },
        callback: function (data) {
            console.log(data);
            if (data.status === "successful") {
                updatePremiumStatus();
            }
        },
        onclose: function() {
            console.log("Payment cancelled");
        },
        customizations: {
            title: "Campus Boost Premium",
            description: "Monthly Premium Subscription",
            logo: "https://via.placeholder.com/100x100?text=CB",
        },
    });
};

async function updatePremiumStatus() {
    try {
        const newExpiry = new Date();
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isPremium: true,
            premiumExpiry: newExpiry,
            isTrialUser: false
        });
        
        userIsPremium = true;
        location.reload();
    } catch (error) {
        console.error('Error updating premium status:', error);
    }
}

// Utility Functions
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    renderTodos();
    renderFlashcardList();
    renderGoals();
    renderHabits();
    updateVocabStats();
    showVocabWord();
    
    // Load note on page load
    loadNote();
    
    // Load profile data if on profile section
    if (currentUser) {
        setTimeout(() => {
            document.getElementById('email').value = currentUser.email;
        }, 1000);
    }
    
    // Check trial status every minute to handle real-time expiration
    setInterval(async () => {
        if (currentUser) {
            await loadUserData(currentUser);
            checkPremiumStatus();
        }
    }, 60000);
    
    // Initialize unit converter
    updateConverterUnits();
    
    // Auto-save notes every 30 seconds
    setInterval(() => {
        const noteContent = document.getElementById('noteEditor')?.value;
        const noteTitle = document.getElementById('noteTitle')?.value;
        if (noteContent && noteContent.trim() !== '') {
            localStorage.setItem('campusBoostNote', JSON.stringify({
                title: noteTitle || 'Untitled Note',
                content: noteContent,
                lastSaved: new Date().toISOString()
            }));
            updateLastSaved();
        }
    }, 30000);
});

// Profile update function
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const fullName = document.getElementById('fullName').value;
        const username = document.getElementById('username').value;
        const contact = document.getElementById('contact').value;
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            fullName: fullName,
            username: username,
            contact: contact,
            updatedAt: new Date()
        });
        
        alert('Profile updated successfully!');
        loadUserData(currentUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile. Please try again.');
    }
});

// Budget functions
document.getElementById('budgetForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('expenseCategory').value;
    const amount = document.getElementById('expenseAmount').value;
    const description = document.getElementById('expenseDescription').value;
    
    // Add expense logic here
    alert(`Expense added: ${category} - ₦${amount}`);
    document.getElementById('budgetForm').reset();
});

// Utility Functions for existing features
window.saveTimetable = function() {
    alert('Timetable saved successfully! Premium users can export as PDF.');
};

window.showAddProduct = function() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal fade" id="addProductModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">📦 Add New Product</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="productForm">
                            <div class="mb-3">
                                <label class="form-label">Product Name</label>
                                <input type="text" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Description</label>
                                <textarea class="form-control" rows="3" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Price (₦)</label>
                                <input type="number" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Category</label>
                                <select class="form-control" required>
                                    <option value="">Select Category</option>
                                    <option value="textbooks">Textbooks</option>
                                    <option value="electronics">Electronics</option>
                                    <option value="clothing">Clothing</option>
                                    <option value="services">Services</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Post Product</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    new bootstrap.Modal(document.getElementById('addProductModal')).show();
};

window.showPromoteProduct = function() {
    if (!userIsPremium) {
        showPayment();
        return;
    }
    alert('Product promotion feature - Premium users can promote their items for better visibility!');
};
