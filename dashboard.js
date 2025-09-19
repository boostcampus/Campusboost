
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
    { word: "abate", meaning: "to reduce in amount, degree, or intensity; to subside. E.g., The storm finally abated after hours of heavy rain.", difficulty: "advanced" },
    { word: "abdicate", meaning: "to formally give up a position of power or a right. E.g., The king was forced to abdicate the throne.", difficulty: "advanced" },
    { word: "aberrant", meaning: "departing from an accepted standard; abnormal. E.g., His aberrant behavior worried his friends.", difficulty: "advanced" },
    { word: "abeyance", meaning: "a state of temporary disuse or suspension. E.g., The project was held in abeyance until further funding was approved.", difficulty: "advanced" },
    { word: "abhor", meaning: "to regard with disgust and hatred. E.g., She abhors violence in all its forms.", difficulty: "advanced" },
    { word: "abide", meaning: "to accept or act in accordance with a rule or decision. Often used as 'cannot abide' meaning to dislike strongly. E.g., I cannot abide people who are cruel to animals.", difficulty: "intermediate" },
    { word: "abject", meaning: "experienced to the maximum degree, especially of something bad; utterly hopeless. E.g., They lived in abject poverty.", difficulty: "advanced" },
    { word: "abjure", meaning: "to solemnly renounce a belief, cause, or claim. E.g., The heretic was forced to abjure his beliefs.", difficulty: "advanced" },
    { word: "ablution", meaning: "the act of washing oneself, often for ritual purposes. E.g., He performed his ablutions before prayer.", difficulty: "advanced" },
    { word: "abnegation", meaning: "the act of renouncing or rejecting something; self-denial. E.g., His abnegation of worldly pleasures was admirable.", difficulty: "advanced" },
    { word: "abolish", meaning: "to formally put an end to a system, practice, or institution. E.g., They fought to abolish slavery.", difficulty: "intermediate" },
    { word: "abominable", meaning: "causing moral revulsion; very unpleasant. E.g., The prison conditions were abominable.", difficulty: "advanced" },
    { word: "aboriginal", meaning: "relating to the original, indigenous people of a region. E.g., They studied Aboriginal art from Australia.", difficulty: "intermediate" },
    { word: "abortive", meaning: "failing to produce the intended result; unsuccessful. E.g., They made an abortive attempt to climb the mountain.", difficulty: "advanced" },
    { word: "abridge", meaning: "to shorten a piece of writing without losing the sense. E.g., This is an abridged version of the novel for children.", difficulty: "advanced" },
    { word: "abrogate", meaning: "to repeal or do away with a law, right, or formal agreement. E.g., The government moved to abrogate the treaty.", difficulty: "advanced" },
    { word: "abscond", meaning: "to leave hurriedly and secretly, typically to avoid detection or arrest. E.g., The suspect absconded with the stolen goods.", difficulty: "advanced" },
    { word: "absolute", meaning: "not qualified or diminished in any way; total; viewed or existing independently. E.g., The emperor had absolute power.", difficulty: "intermediate" },
    { word: "absolve", meaning: "to set someone free from guilt, obligation, or punishment. E.g., The court absolved him of all responsibility for the accident.", difficulty: "advanced" },
    { word: "abstain", meaning: "to restrain oneself from doing or enjoying something; to formally decline to vote. E.g., He chose to abstain from alcohol. Several senators abstained from the vote.", difficulty: "advanced" },
    { word: "abstract", meaning: "existing in thought or as an idea but not having a physical or concrete existence; a summary. E.g., She enjoys abstract art. Write an abstract of your paper.", difficulty: "intermediate" },
    { word: "abstruse", meaning: "difficult to understand; obscure. E.g., The professor's lecture was on an abstruse philosophical topic.", difficulty: "advanced" },
    { word: "abundant", meaning: "existing or available in large quantities; plentiful", difficulty: "intermediate" },
    { word: "abysmal", meaning: "extremely bad; appalling. E.g., The team's performance was abysmal.", difficulty: "advanced" },
    { word: "accolade", meaning: "an award or privilege granted as a special honor or recognition for merit. E.g., The film received accolades from critics.", difficulty: "advanced" },
    { word: "accommodate", meaning: "to provide lodging or space for; to fit in with the wishes or needs of. E.g., The hotel can accommodate up to 500 guests. We will accommodate your schedule.", difficulty: "intermediate" },
    { word: "accord", meaning: "an official agreement or treaty; to give or grant someone power or recognition. E.g., The peace accord was signed. He was accorded the highest honors.", difficulty: "intermediate" },
    { word: "accost", meaning: "to approach and address someone boldly or aggressively. E.g., He was accosted by beggars on the street.", difficulty: "advanced" },
    { word: "acerbic", meaning: "sharp and forthright, especially in speech; tasting sour or bitter. E.g., She was known for her acerbic wit.", difficulty: "advanced" },
    { word: "acme", meaning: "the point at which something is at its best or highest; the peak. E.g., The empire was at the acme of its power.", difficulty: "advanced" },
    { word: "acquiesce", meaning: "to accept something reluctantly but without protest. E.g., With a sigh, he acquiesced to their demands.", difficulty: "advanced" },
    { word: "acrid", meaning: "having an irritatingly strong and unpleasant smell or taste. E.g., The acrid smell of smoke filled the air.", difficulty: "advanced" },
    { word: "acrimonious", meaning: "angry and bitter, typically in speech or debate. E.g., The meeting ended in an acrimonious argument.", difficulty: "advanced" },
    { word: "acumen", meaning: "the ability to make good judgments and quick decisions, typically in a particular domain. E.g., She has considerable business acumen.", difficulty: "advanced" },
    { word: "acute", meaning: "present or experienced to a severe or intense degree; having a sharp end; perceptive. E.g., He felt acute pain. She has an acute understanding of the problem.", difficulty: "intermediate" },
    { word: "adamant", meaning: "refusing to be persuaded or to change one's mind. E.g., She was adamant that she would not go.", difficulty: "intermediate" },
    { word: "adept", meaning: "very skilled or proficient at something. E.g., He is adept at solving complex problems.", difficulty: "advanced" },
    { word: "adhere", meaning: "to stick firmly to a surface, substance, or belief. E.g., The label will adhere to any clean surface. They adhere to a strict code of ethics.", difficulty: "intermediate" },
    { word: "admonish", meaning: "to warn or reprimand someone firmly; to advise earnestly. E.g., The teacher admonished the class for being too noisy.", difficulty: "advanced" },
    { word: "adorn", meaning: "to make more beautiful or attractive; to decorate. E.g., The walls were adorned with paintings.", difficulty: "intermediate" },
    { word: "adroit", meaning: "clever or skillful in using the hands or mind. E.g., He was an adroit negotiator.", difficulty: "advanced" },
    { word: "adulation", meaning: "excessive admiration or praise. E.g., The star was uncomfortable with the adulation of his fans.", difficulty: "advanced" },
    { word: "adverse", meaning: "preventing success or development; harmful; unfavorable. E.g., The company faced adverse economic conditions.", difficulty: "intermediate" },
    { word: "advocate", meaning: "to publicly recommend or support; a person who publicly supports or recommends a particular cause or policy. E.g., She advocates for children's rights. He is a passionate advocate for reform.", difficulty: "intermediate" },
    { word: "aesthetic", meaning: "concerned with beauty or the appreciation of beauty. E.g., The building's design has great aesthetic appeal.", difficulty: "intermediate" },
    { word: "affable", meaning: "friendly, good-natured, and easy to talk to. E.g., He was an affable and welcoming host.", difficulty: "advanced" },
    { word: "affinity", meaning: "a natural liking for and understanding of someone or something. E.g., She has a natural affinity for languages.", difficulty: "advanced" },
    { word: "affluent", meaning: "having a great deal of money; wealthy. E.g., They live in an affluent suburb.", difficulty: "intermediate" },
    { word: "affront", meaning: "an action or remark that causes outrage or offense. E.g., His comment was an affront to everyone in the room.", difficulty: "advanced" },
    { word: "aggregate", meaning: "a whole formed by combining several separate elements; to form or group into a class or cluster. E.g., The aggregate of all our suggestions. They aggregated the data from multiple sources.", difficulty: "advanced" },
    { word: "aghast", meaning: "filled with horror or shock. E.g., She was aghast at the violence of the film.", difficulty: "advanced" },
    { word: "agile", meaning: "able to move quickly and easily; able to think and understand quickly. E.g., An agile gymnast. An agile mind.", difficulty: "intermediate" },
    { word: "agog", meaning: "very eager or curious to hear or see something. E.g., The audience was agog with anticipation.", difficulty: "advanced" },
    { word: "alacrity", meaning: "brisk and cheerful readiness; eagerness. E.g., She accepted the invitation with alacrity.", difficulty: "advanced" },
    { word: "albeit", meaning: "although. E.g., He agreed, albeit reluctantly, to the plan.", difficulty: "advanced" },
    { word: "alienate", meaning: "to cause someone to feel isolated or estranged; to transfer ownership of property. E.g., His arrogant behavior alienated his colleagues.", difficulty: "intermediate" },
    { word: "alleviate", meaning: "to make suffering, deficiency, or a problem less severe. E.g., The medicine helped to alleviate her pain.", difficulty: "intermediate" },
    { word: "allocate", meaning: "to distribute resources or duties for a particular purpose. E.g., Funds were allocated to the new project.", difficulty: "intermediate" },
    { word: "allude", meaning: "to suggest or call attention to indirectly; hint at. E.g., He alluded to problems in his past without specifying them.", difficulty: "advanced" },
    { word: "allure", meaning: "the quality of being powerfully and mysteriously attractive or fascinating. E.g., The allure of ancient ruins.", difficulty: "advanced" },
    { word: "aloof", meaning: "not friendly or forthcoming; cool and distant. E.g., She remained aloof from the office gossip.", difficulty: "advanced" },
    { word: "altruistic", meaning: "showing a selfless concern for the well-being of others; unselfish. E.g., Her altruistic work with the poor was inspiring.", difficulty: "advanced" },
    { word: "amalgamate", meaning: "to combine or unite to form one organization or structure. E.g., The two companies amalgamated to form a giant corporation.", difficulty: "advanced" },
    { word: "ambiguous", meaning: "open to more than one interpretation; not clear or decided. E.g., His answer was ambiguous and confusing.", difficulty: "intermediate" },
    { word: "ambivalent", meaning: "having mixed feelings or contradictory ideas about something or someone. E.g., She felt ambivalent about moving to a new city.", difficulty: "advanced" },
    { word: "ameliorate", meaning: "to make something bad or unsatisfactory better. E.g., Steps were taken to ameliorate the situation.", difficulty: "advanced" },
    { word: "amenable", meaning: "open and responsive to suggestion; easily persuaded or controlled. E.g., He was amenable to changing the schedule.", difficulty: "advanced" },
    { word: "amend", meaning: "to make minor changes to a text, law, or contract to improve it. E.g., The constitution was amended to grant voting rights.", difficulty: "intermediate" },
    { word: "amenity", meaning: "a desirable or useful feature or facility of a building or place. E.g., The hotel amenities include a pool and a gym.", difficulty: "intermediate" },
    { word: "amiable", meaning: "having or displaying a friendly and pleasant manner. E.g., He was an amiable old man.", difficulty: "advanced" },
    { word: "amicable", meaning: "characterized by friendliness and absence of discord. E.g., They reached an amicable settlement.", difficulty: "intermediate" },
    { word: "amorphous", meaning: "without a clearly defined shape or form. E.g., An amorphous mass of clay. Amorphous plans.", difficulty: "advanced" },
    { word: "anachronism", meaning: "something or someone that is not in its correct historical or chronological time. E.g., The film was full of anachronisms, like a watch in a medieval scene.", difficulty: "advanced" },
    { word: "analogous", meaning: "comparable in certain respects, typically in a way that makes clearer the nature of the things compared. E.g., The situation is analogous to one we faced last year.", difficulty: "advanced" },
    { word: "anarchy", meaning: "a state of disorder due to absence or non-recognition of authority. E.g., The country descended into anarchy after the revolution.", difficulty: "intermediate" },
    { word: "anecdote", meaning: "a short and amusing or interesting story about a real incident or person. E.g., He told an anecdote about his first day at work.", difficulty: "intermediate" },
    { word: "anguish", meaning: "severe mental or physical pain or suffering. E.g., She cried out in anguish.", difficulty: "advanced" },
    { word: "animosity", meaning: "strong hostility. E.g., There was animosity between the two rival gangs.", difficulty: "advanced" },
    { word: "annihilate", meaning: "to destroy utterly; to obliterate. E.g., The invading army was annihilated.", difficulty: "advanced" },
    { word: "anomaly", meaning: "something that deviates from what is standard, normal, or expected. E.g., A bird that cannot fly is an anomaly.", difficulty: "advanced" },
    { word: "anonymous", meaning: "not identified by name; of unknown name. E.g., An anonymous donor gave a million dollars.", difficulty: "intermediate" },
    { word: "antagonize", meaning: "to cause someone to become hostile; to provoke. E.g., He didn't want to antagonize his boss.", difficulty: "advanced" },
    { word: "antecedent", meaning: "a thing or event that existed before or logically precedes another. E.g., The events were antecedents to the war.", difficulty: "advanced" },
    { word: "antipathy", meaning: "a deep-seated feeling of dislike; aversion. E.g., She felt a strong antipathy towards him.", difficulty: "advanced" },
    { word: "apathy", meaning: "lack of interest, enthusiasm, or concern. E.g., Voter apathy is a problem in many elections.", difficulty: "intermediate" },
    { word: "apocryphal", meaning: "of doubtful authenticity, although widely circulated as being true. E.g., The story is probably apocryphal.", difficulty: "advanced" },
    { word: "appall", meaning: "to greatly dismay or horrify. E.g., The news of the tragedy appalled the nation.", difficulty: "intermediate" },
    { word: "apprehend", meaning: "to arrest someone; to understand or perceive. E.g., The police apprehended the suspect. It is difficult to apprehend the scale of the universe.", difficulty: "advanced" },
    { word: "arbitrary", meaning: "based on random choice or personal whim, rather than any reason or system. E.g., An arbitrary decision.", difficulty: "intermediate" },
    { word: "arcane", meaning: "understood by few; mysterious or secret. E.g., Arcane rules of ancient magic.", difficulty: "advanced" },
    { word: "archaic", meaning: "very old or old-fashioned; of an early period. E.g., Archaic language in the text.", difficulty: "advanced" },
    { word: "ardent", meaning: "very enthusiastic or passionate. E.g., An ardent supporter of human rights.", difficulty: "advanced" },
    { word: "arduous", meaning: "involving or requiring strenuous effort; difficult and tiring. E.g., An arduous journey through the mountains.", difficulty: "advanced" },
    { word: "arid", meaning: "having little or no rain; too dry or barren to support vegetation; lacking in interest. E.g., An arid climate. An arid lecture.", difficulty: "intermediate" },
    { word: "arrogate", meaning: "to take or claim something without justification. E.g., He arrogated to himself the right to make decisions.", difficulty: "advanced" },
    { word: "articulate", meaning: "having or showing the ability to speak fluently and coherently; to express an idea clearly. E.g., She was articulate and well-spoken. He struggled to articulate his feelings.", difficulty: "intermediate" },
    { word: "ascend", meaning: "to go up or climb. E.g., The path ascends to the top of the hill.", difficulty: "intermediate" },
    { word: "ascertain", meaning: "to find something out for certain; to make sure of. E.g., The police are trying to ascertain the facts.", difficulty: "advanced" },
    { word: "ascetic", meaning: "characterized by severe self-discipline and abstention from all forms of indulgence, typically for religious reasons. E.g., He lived an ascetic life in a small cell.", difficulty: "advanced" },
    { word: "ascribe", meaning: "to attribute something to a cause. E.g., He ascribed his success to hard work.", difficulty: "advanced" },
    { word: "aspire", meaning: "to direct one's hopes or ambitions toward achieving something. E.g., She aspired to become a doctor.", difficulty: "intermediate" },
    { word: "assail", meaning: "to make a concerted or violent attack on. E.g., He was assailed by doubts.", difficulty: "advanced" },
    { word: "assimilate", meaning: "to take in and understand fully; to absorb and integrate into a wider society or culture. E.g., The students need time to assimilate the information. Immigrants often assimilate into their new country.", difficulty: "advanced" },
    { word: "assuage", meaning: "to make an unpleasant feeling less intense; to satisfy an appetite or desire. E.g., The letter assuaged his fears. A milkshake to assuage your thirst.", difficulty: "advanced" },
    { word: "astute", meaning: "having or showing an ability to accurately assess situations or people and turn this to one's advantage; shrewd. E.g., An astute businesswoman.", difficulty: "advanced" },
    { word: "asylum", meaning: "the protection granted by a state to someone who has left their home country as a political refugee; an old-fashioned term for a mental hospital. E.g., He sought asylum from political persecution.", difficulty: "intermediate" },
    { word: "atone", meaning: "to make amends or reparation for a wrong. E.g., He tried to atone for his sins.", difficulty: "advanced" },
    { word: "atrophy", meaning: "to gradually decline in effectiveness or vigor due to underuse or neglect; the wasting away of a body part. E.g., Muscles can atrophy if not used.", difficulty: "advanced" },
    { word: "attest", meaning: "to provide or serve as clear evidence of. E.g., His success attests to his determination.", difficulty: "advanced" },
    { word: "audacious", meaning: "showing a willingness to take surprisingly bold risks; showing a lack of respect. E.g., An audacious plan. An audacious remark.", difficulty: "advanced" },
    { word: "augment", meaning: "to make something greater by adding to it; increase. E.g., He augmented his income by taking a second job.", difficulty: "advanced" },
    { word: "auspicious", meaning: "conducive to success; favorable. E.g., An auspicious start to the project.", difficulty: "advanced" },
    { word: "austere", meaning: "severe or strict in manner or appearance; having no comforts or luxuries. E.g., An austere lifestyle. An austere building.", difficulty: "advanced" },
    { word: "authentic", meaning: "of undisputed origin; genuine; made to be exactly as the original. E.g., An authentic signature. Authentic Italian food.", difficulty: "intermediate" },
    { word: "authoritarian", meaning: "favoring or enforcing strict obedience to authority at the expense of personal freedom. E.g., An authoritarian regime.", difficulty: "intermediate" },
    { word: "autonomous", meaning: "having the freedom to govern itself or control its own affairs; acting independently. E.g., An autonomous region.", difficulty: "intermediate" },
    { word: "avarice", meaning: "extreme greed for wealth or material gain. E.g., The story is a warning against avarice.", difficulty: "advanced" },
    { word: "avenge", meaning: "to inflict harm in return for an injury or wrong done to oneself or another. E.g., He wanted to avenge his father's murder.", difficulty: "intermediate" },
    { word: "averse", meaning: "having a strong dislike of or opposition to something. E.g., He is not averse to taking risks.", difficulty: "intermediate" },
    { word: "avert", meaning: "to turn away one's eyes or thoughts; to prevent or ward off an undesirable occurrence. E.g., She averted her gaze. He averted a disaster.", difficulty: "intermediate" },
    { word: "avid", meaning: "having or showing a keen interest in or enthusiasm for something. E.g., An avid reader.", difficulty: "intermediate" },
    { word: "benevolent", meaning: "well meaning and kindly", difficulty: "advanced" },
    { word: "benevolence", meaning: "the quality of being well meaning; kindness. E.g., He did it out of pure benevolence.", difficulty: "advanced" },
    { word: "benign", meaning: "gentle and kindly; not harmful in effect. E.g., A benign old lady. A benign tumor.", difficulty: "advanced" },
    { word: "berate", meaning: "to scold or criticize someone angrily. E.g., She berated him for his laziness.", difficulty: "advanced" },
    { word: "bizarre", meaning: "very strange or unusual. E.g., A bizarre coincidence.", difficulty: "intermediate" },
    { word: "blatant", meaning: "done openly and unashamedly; obvious. E.g., A blatant lie.", difficulty: "intermediate" },
    { word: "blight", meaning: "a thing that causes great difficulty or damage; a plant disease. E.g., Urban blight. Potato blight.", difficulty: "advanced" },
    { word: "blithe", meaning: "showing a casual and cheerful indifference considered to be callous or improper. E.g., A blithe disregard for the rules.", difficulty: "advanced" },
    { word: "boisterous", meaning: "noisy, energetic, and cheerful; rowdy. E.g., A boisterous crowd of fans.", difficulty: "advanced" },
    { word: "bolster", meaning: "to support or strengthen; prop up. E.g., The news bolstered his confidence.", difficulty: "advanced" },
    { word: "bombastic", meaning: "high-sounding but with little meaning; inflated. E.g., A bombastic speech.", difficulty: "advanced" },
    { word: "boorish", meaning: "rough and bad-mannered; coarse. E.g., Boorish behavior.", difficulty: "advanced" },
    { word: "brevity", meaning: "concise and exact use of words in writing or speech; shortness of time. E.g., The brevity of his letter. The brevity of human life.", difficulty: "advanced" },
    { word: "brusque", meaning: "abrupt or offhand in speech or manner. E.g., A brusque reply.", difficulty: "advanced" },
    { word: "cacophony", meaning: "a harsh, discordant mixture of sounds. E.g., A cacophony of car horns.", difficulty: "advanced" },
    { word: "cajole", meaning: "to persuade someone to do something by sustained coaxing or flattery. E.g., He cajoled her into going.", difficulty: "advanced" },
    { word: "calamity", meaning: "an event causing great and often sudden damage or distress; a disaster. E.g., A natural calamity.", difficulty: "advanced" },
    { word: "callous", meaning: "showing or having an insensitive and cruel disregard for others. E.g., A callous disregard for suffering.", difficulty: "advanced" },
    { word: "candid", meaning: "truthful and straightforward; frank. E.g., A candid interview.", difficulty: "intermediate" },
    { word: "candor", meaning: "the quality of being open and honest in expression; frankness. E.g., She spoke with refreshing candor.", difficulty: "advanced" },
    { word: "capacious", meaning: "having a lot of space inside; roomy. E.g., A capacious bag.", difficulty: "advanced" },
    { word: "capitulate", meaning: "to cease to resist an opponent or an unwelcome demand; surrender. E.g., The army was forced to capitulate.", difficulty: "advanced" },
    { word: "capricious", meaning: "given to sudden and unaccountable changes of mood or behavior. E.g., A capricious climate.", difficulty: "advanced" },
    { word: "cardinal", meaning: "of the greatest importance; fundamental. E.g., A cardinal rule.", difficulty: "advanced" },
    { word: "catalyst", meaning: "a person or thing that precipitates an event or change. E.g., She was a catalyst for reform.", difficulty: "advanced" },
    { word: "caustic", meaning: "sarcastic in a scathing and bitter way; able to burn or corrode. E.g., Caustic remarks. A caustic chemical.", difficulty: "advanced" },
    { word: "censure", meaning: "to express severe disapproval of someone or something, typically in a formal statement. E.g., The judge was censured for his behavior.", difficulty: "advanced" },
    { word: "cerebral", meaning: "intellectual rather than emotional or physical. E.g., A cerebral film.", difficulty: "advanced" },
    { word: "chaos", meaning: "complete disorder and confusion. E.g., The room was in chaos.", difficulty: "intermediate" },
    { word: "charlatan", meaning: "a person falsely claiming to have a special knowledge or skill; a fraud. E.g., He was exposed as a charlatan.", difficulty: "advanced" },
    { word: "chastise", meaning: "to rebuke or reprimand severely. E.g., He chastised his colleagues for their laziness.", difficulty: "advanced" },
    { word: "chicanery", meaning: "the use of trickery to achieve a political, financial, or legal purpose. E.g., He wasn't above using chicanery to win.", difficulty: "advanced" },
    { word: "chronological", meaning: "arranged in the order of time. E.g., A chronological list of events.", difficulty: "intermediate" },
    { word: "circuitous", meaning: "longer than the most direct way; roundabout. E.g., A circuitous route.", difficulty: "advanced" },
    { word: "circumspect", meaning: "wary and unwilling to take risks; cautious. E.g., The officials were very circumspect in their statements.", difficulty: "advanced" },
    { word: "clairvoyant", meaning: "a person who claims to have a supernatural ability to perceive events in the future or beyond normal sensory contact. E.g., She went to a clairvoyant to learn her future.", difficulty: "advanced" },
    { word: "clandestine", meaning: "kept secret or done secretively, especially because illicit. E.g., A clandestine meeting.", difficulty: "advanced" },
    { word: "clemency", meaning: "mercy; lenience. E.g., The judge showed clemency.", difficulty: "advanced" },
    { word: "cliché", meaning: "a phrase or opinion that is overused and betrays a lack of original thought. E.g., The ending was a bit of a cliché.", difficulty: "intermediate" },
    { word: "clientele", meaning: "the customers of a shop, bar, or place of entertainment. E.g., A wealthy clientele.", difficulty: "intermediate" },
    { word: "clout", meaning: "influence or power, especially in politics or business. E.g., He has a lot of clout in the industry.", difficulty: "advanced" },
    { word: "coalesce", meaning: "to come together to form one mass or whole. E.g., The puddles coalesced into a small stream.", difficulty: "advanced" },
    { word: "cogent", meaning: "clear, logical, and convincing. E.g., A cogent argument.", difficulty: "advanced" },
    { word: "cognitive", meaning: "relating to thinking or conscious mental processes", difficulty: "advanced" },
    { word: "coherent", meaning: "logical and consistent; forming a unified whole. E.g., A coherent argument.", difficulty: "intermediate" },
    { word: "collaborate", meaning: "to work jointly on an activity or project. E.g., The two companies collaborated on the new software.", difficulty: "intermediate" },
    { word: "colloquial", meaning: "used in ordinary or familiar conversation; not formal or literary. E.g., Colloquial expressions.", difficulty: "advanced" },
    { word: "collusion", meaning: "secret or illegal cooperation or conspiracy, especially in order to cheat or deceive others. E.g., The companies were accused of collusion.", difficulty: "advanced" },
    { word: "commemorate", meaning: "to recall and show respect for someone or something. E.g., A ceremony to commemorate the dead.", difficulty: "intermediate" },
    { word: "commend", meaning: "to praise formally or officially. E.g., He was commended for his bravery.", difficulty: "intermediate" },
    { word: "commensurate", meaning: "corresponding in size or degree; in proportion. E.g., Salary will be commensurate with experience.", difficulty: "advanced" },
    { word: "commodious", meaning: "roomy and comfortable. E.g., A commodious apartment.", difficulty: "advanced" },
    { word: "communal", meaning: "shared by all members of a community; for common use. E.g., Communal gardens.", difficulty: "intermediate" },
    { word: "compassion", meaning: "sympathetic pity and concern for the sufferings or misfortunes of others. E.g., She showed great compassion for the homeless.", difficulty: "intermediate" },
    { word: "compatible", meaning: "able to exist or occur together without conflict. E.g., The software is compatible with your operating system.", difficulty: "intermediate" },
    { word: "compelling", meaning: "evoking interest, attention, or admiration in a powerfully irresistible way; not able to be refuted. E.g., A compelling story. Compelling evidence.", difficulty: "intermediate" },
    { word: "compensate", meaning: "to give someone something, typically money, in recognition of loss, suffering, or injury; to make up for something undesirable. E.g., The company compensated the injured workers. His enthusiasm compensates for his lack of skill.", difficulty: "intermediate" },
    { word: "complacent", meaning: "showing smug or uncritical satisfaction with oneself or one's achievements. E.g., We cannot afford to be complacent about security.", difficulty: "advanced" },
    { word: "complement", meaning: "a thing that completes or brings to perfection; to add to something in a way that enhances or improves it. E.g., The wine is a perfect complement to the cheese. The scarf complements her outfit.", difficulty: "intermediate" },
    { word: "compliant", meaning: "inclined to agree with others or obey rules, especially to an excessive degree; acquiescent. E.g., A compliant child.", difficulty: "advanced" },
    { word: "comprehensive", meaning: "complete; including all or nearly all elements or aspects of something. E.g., A comprehensive guide.", difficulty: "intermediate" },
    { word: "compromise", meaning: "an agreement or settlement of a dispute that is reached by each side making concessions; to settle a dispute by mutual concession. E.g., They reached a compromise. Neither side is willing to compromise.", difficulty: "intermediate" },
    { word: "compunction", meaning: "a feeling of guilt or moral scruple that prevents or follows the doing of something bad. E.g., She felt no compunction about lying.", difficulty: "advanced" },
    { word: "concede", meaning: "to admit that something is true or valid after first denying or resisting it; to surrender. E.g., I concede that you have a point. The army conceded defeat.", difficulty: "intermediate" },
    { word: "concise", meaning: "giving a lot of information clearly and in a few words; brief but comprehensive. E.g., A concise summary.", difficulty: "intermediate" },
    { word: "concur", meaning: "to be of the same opinion; to agree. E.g., The judges concurred with the verdict.", difficulty: "advanced" },
    { word: "condescend", meaning: "to show feelings of superiority; to be patronizing. E.g., He condescended to speak to me.", difficulty: "advanced" },
    { word: "condone", meaning: "to accept and allow behavior that is considered morally wrong or offensive to continue. E.g., The school cannot condone bullying.", difficulty: "intermediate" },
    { word: "conducive", meaning: "making a certain situation or outcome likely or possible. E.g., An environment conducive to learning.", difficulty: "advanced" },
    { word: "confide", meaning: "to tell someone about a secret or private matter while trusting them not to repeat it to others. E.g., She confided her fears to her friend.", difficulty: "intermediate" },
    { word: "congenial", meaning: "pleasant because of a personality, qualities, or interests that are similar to one's own. E.g., A congenial atmosphere.", difficulty: "advanced" },
    { word: "congenital", meaning: "present from birth. E.g., A congenital disease.", difficulty: "advanced" },
    { word: "conglomerate", meaning: "a thing consisting of a number of different and distinct parts or items that are grouped together; a large corporation formed by the merging of separate firms. E.g., A conglomerate of companies.", difficulty: "advanced" },
    { word: "congruent", meaning: "in agreement or harmony; identical in form; coinciding exactly when superimposed. E.g., Their goals are congruent with ours. Congruent triangles.", difficulty: "advanced" },
    { word: "conjecture", meaning: "an opinion or conclusion formed on the basis of incomplete information; guesswork. E.g., That is pure conjecture.", difficulty: "advanced" },
    { word: "connoisseur", meaning: "an expert judge in matters of taste. E.g., A connoisseur of fine wine.", difficulty: "advanced" },
    { word: "conscientious", meaning: "wishing to do what is right, especially to do one's work or duty well and thoroughly. E.g., A conscientious worker.", difficulty: "intermediate" },
    { word: "consecutive", meaning: "following continuously; in unbroken or logical sequence. E.g., It rained for three consecutive days.", difficulty: "intermediate" },
    { word: "consensus", meaning: "a general agreement. E.g., There is a consensus among experts.", difficulty: "intermediate" },
    { word: "consign", meaning: "to deliver something to a person's custody; typically to send goods to a buyer. E.g., The goods were consigned to him last week.", difficulty: "advanced" },
    { word: "consolidate", meaning: "to make something physically stronger or more solid; to combine a number of things into a single more effective or coherent whole. E.g., Consolidate your debts into one loan.", difficulty: "intermediate" },
    { word: "conspicuous", meaning: "standing out so as to be clearly visible; attracting notice or attention. E.g., He was conspicuous by his absence.", difficulty: "intermediate" },
    { word: "conspire", meaning: "to make secret plans jointly to commit an unlawful or harmful act. E.g., They conspired to overthrow the government.", difficulty: "intermediate" },
    { word: "constituent", meaning: "being a part of a whole; a component. E.g., What are the constituent parts of an atom?", difficulty: "advanced" },
    { word: "constrain", meaning: "to compel or force someone to follow a particular course of action; to restrict or limit. E.g., He felt constrained to obey. Time constraints.", difficulty: "advanced" },
    { word: "construe", meaning: "to interpret a word or action in a particular way. E.g., His comments could be construed as criticism.", difficulty: "advanced" },
    { word: "contagious", meaning: "spread from one person or organism to another by direct or indirect contact. E.g., A contagious disease. Contagious laughter.", difficulty: "intermediate" },
    { word: "contemplate", meaning: "to look thoughtfully for a long time at; to think deeply about. E.g., He sat contemplating the painting. She contemplated her future.", difficulty: "intermediate" },
    { word: "contemporary", meaning: "living or occurring at the same time; belonging to or occurring in the present. E.g., Contemporary literature. Contemporary events.", difficulty: "intermediate" },
    { word: "contempt", meaning: "the feeling that a person or a thing is beneath consideration, worthless, or deserving scorn. E.g., He showed his contempt for the rules.", difficulty: "intermediate" },
    { word: "contend", meaning: "to struggle to surmount a difficulty; to assert something as a position in an argument. E.g., She had to contend with his temper. The lawyer contended that her client was innocent.", difficulty: "intermediate" },
    { word: "contentious", meaning: "causing or likely to cause an argument; controversial. E.g., A contentious issue.", difficulty: "advanced" },
    { word: "contrite", meaning: "feeling or expressing remorse or penitence; affected by guilt. E.g., He was contrite after his outburst.", difficulty: "advanced" },
    { word: "contrive", meaning: "to create or bring about an object or a situation by deliberate use of skill and artifice; to manage to do something foolish. E.g., He contrived a new engine. She contrived to get lost.", difficulty: "advanced" },
    { word: "conundrum", meaning: "a confusing and difficult problem or question. E.g., A constitutional conundrum.", difficulty: "advanced" },
    { word: "convene", meaning: "to come or bring together for a meeting or activity; assemble. E.g., The committee convened for its monthly meeting.", difficulty: "advanced" },
    { word: "conventional", meaning: "based on or in accordance with what is generally done or believed; traditional. E.g., Conventional wisdom.", difficulty: "intermediate" },
    { word: "converge", meaning: "to come together from different directions so as eventually to meet. E.g., The paths converge at the river.", difficulty: "advanced" },
    { word: "convivial", meaning: "friendly, lively, and enjoyable. E.g., A convivial atmosphere at the party.", difficulty: "advanced" },
    { word: "copious", meaning: "abundant in supply or quantity. E.g., She took copious notes.", difficulty: "advanced" },
    { word: "cordial", meaning: "warm and friendly. E.g., A cordial greeting.", difficulty: "intermediate" },
    { word: "corroborate", meaning: "to confirm or give support to a statement, theory, or finding. E.g., The evidence corroborates his story.", difficulty: "advanced" },
    { word: "corrosive", meaning: "tending to cause corrosion; harmful and destructive. E.g., A corrosive acid. Corrosive criticism.", difficulty: "advanced" },
    { word: "cosmopolitan", meaning: "familiar with and at ease in many different countries and cultures. E.g., A cosmopolitan city.", difficulty: "advanced" },
    { word: "counterfeit", meaning: "made in exact imitation of something valuable with the intention to deceive or defraud; fake. E.g., Counterfeit money.", difficulty: "intermediate" },
    { word: "coup", meaning: "a sudden, violent, and illegal seizure of power from a government; a notable or successful stroke or move. E.g., A military coup. A publicity coup.", difficulty: "intermediate" },
    { word: "covet", meaning: "to yearn to possess something, especially something belonging to someone else. E.g., He coveted his neighbor's car.", difficulty: "advanced" },
    { word: "covert", meaning: "not openly acknowledged or displayed; secret. E.g., Covert operations.", difficulty: "advanced" },
    { word: "credible", meaning: "able to be believed; convincing. E.g., A credible witness.", difficulty: "intermediate" },
    { word: "credulous", meaning: "having or showing too great a readiness to believe things; gullible. E.g., A credulous audience.", difficulty: "advanced" },
    { word: "criterion", meaning: "a principle or standard by which something may be judged or decided. E.g., The main criterion is value for money.", difficulty: "intermediate" },
    { word: "crucial", meaning: "decisive or critical, especially in the success or failure of something. E.g., A crucial decision.", difficulty: "intermediate" },
    { word: "cryptic", meaning: "having a meaning that is mysterious or obscure. E.g., A cryptic message.", difficulty: "advanced" },
    { word: "culminate", meaning: "to reach a climax or point of highest development. E.g., The festivities culminated in a firework display.", difficulty: "advanced" },
    { word: "culpable", meaning: "deserving blame; guilty. E.g., They held him culpable for the accident.", difficulty: "advanced" },
    { word: "cultivate", meaning: "to try to acquire or develop a quality, sentiment, or skill; to prepare and use land for crops or gardening. E.g., Cultivate a positive attitude. Cultivate the soil.", difficulty: "intermediate" },
    { word: "cumbersome", meaning: "large or heavy and therefore difficult to carry or use; unwieldy; complicated and inefficient. E.g., Cumbersome machinery. A cumbersome process.", difficulty: "advanced" },
    { word: "cursory", meaning: "hasty and therefore not thorough or detailed. E.g., A cursory glance.", difficulty: "advanced" },
    { word: "curtail", meaning: "to reduce in extent or quantity; to impose a restriction on. E.g., Civil liberties were curtailed.", difficulty: "advanced" },
    { word: "cynical", meaning: "believing that people are motivated by self-interest; distrustful of human sincerity or integrity. E.g., A cynical view of politics.", difficulty: "intermediate" },
    { word: "dearth", meaning: "a scarcity or lack of something. E.g., A dearth of evidence.", difficulty: "advanced" },
    { word: "debacle", meaning: "a sudden and ignominious failure; a fiasco. E.g., The economic debacle that led to the recession.", difficulty: "advanced" },
    { word: "debase", meaning: "to reduce quality or value; to lower in character, quality, or value. E.g., To debase the currency.", difficulty: "advanced" },
    { word: "debunk", meaning: "to expose the falseness or hollowness of a myth, idea, or belief. E.g., The myth was debunked by scientists.", difficulty: "advanced" },
    { word: "decorum", meaning: "behavior in keeping with good taste and propriety; etiquette. E.g., He behaved with decorum.", difficulty: "advanced" },
    { word: "decry", meaning: "to publicly denounce. E.g., They decried the lack of funding.", difficulty: "advanced" },
    { word: "deference", meaning: "humble submission and respect. E.g., He treated her with deference.", difficulty: "advanced" },
    { word: "definitive", meaning: "of a conclusion or agreement done or reached decisively and with authority; serving to provide a final solution. E.g., The definitive biography of the president.", difficulty: "intermediate" },
    { word: "deflect", meaning: "to cause something to change direction by interposing something; to turn aside from a straight course. E.g., The shield deflected the arrow. He deflected the question.", difficulty: "intermediate" },
    { word: "deft", meaning: "neatly skillful and quick in one's movements. E.g., Deft fingers.", difficulty: "advanced" },
    { word: "defunct", meaning: "no longer existing or functioning. E.g., A defunct law.", difficulty: "advanced" },
    { word: "delegate", meaning: "to entrust a task or responsibility to another person; a person sent to represent others. E.g., He delegated the task to his assistant. A conference delegate.", difficulty: "intermediate" },
    { word: "deleterious", meaning: "causing harm or damage. E.g., Deleterious effects on health.", difficulty: "advanced" },
    { word: "deliberate", meaning: "done consciously and intentionally; to engage in long and careful consideration. E.g., A deliberate insult. The jury deliberated for hours.", difficulty: "intermediate" },
    { word: "delineate", meaning: "to describe or portray something precisely. E.g., The report delineates the steps necessary.", difficulty: "advanced" },
    { word: "demagogue", meaning: "a political leader who seeks support by appealing to popular desires and prejudices rather than by using rational argument. E.g., A dangerous demagogue.", difficulty: "advanced" },
    { word: "demise", meaning: "a person's death; the end or failure of an enterprise. E.g., The demise of the empire.", difficulty: "advanced" },
    { word: "demographic", meaning: "relating to the structure of populations. E.g., Demographic trends.", difficulty: "intermediate" },
    { word: "demur", meaning: "to raise objections or show reluctance. E.g., She demurred at the suggestion.", difficulty: "advanced" },
    { word: "denigrate", meaning: "to criticize unfairly; to disparage. E.g., He denigrated his opponent's achievements.", difficulty: "advanced" },
    { word: "denounce", meaning: "to publicly declare to be wrong or evil. E.g., The letter denounced the government's policies.", difficulty: "intermediate" },
    { word: "deplete", meaning: "to use up the supply or resources of. E.g., The drought depleted the water supply.", difficulty: "intermediate" },
    { word: "deplore", meaning: "to feel or express strong disapproval of something. E.g., We deplore all violence.", difficulty: "advanced" },
    { word: "depravity", meaning: "moral corruption; wickedness. E.g., A tale of depravity.", difficulty: "advanced" },
    { word: "deprecate", meaning: "to express disapproval of. E.g., He deprecated the lack of funding.", difficulty: "advanced" },
    { word: "deride", meaning: "to express contempt for; to ridicule. E.g., They derided his efforts.", difficulty: "advanced" },
    { word: "derivative", meaning: "imitating the work of another artist, writer, etc., and usually inferior; something that is based on another source. E.g., A derivative artist. A derivative of petroleum.", difficulty: "advanced" },
    { word: "desiccate", meaning: "to remove the moisture from something; to dry out. E.g., Desiccated coconut.", difficulty: "advanced" },
    { word: "despondent", meaning: "in low spirits from loss of hope or courage. E.g., She was despondent over the loss of her job.", difficulty: "advanced" },
    { word: "despot", meaning: "a ruler or other person who holds absolute power, typically one who exercises it in a cruel or oppressive way. E.g., An enlightened despot.", difficulty: "advanced" },
    { word: "destitute", meaning: "without the basic necessities of life; extremely poor. E.g., Destitute families.", difficulty: "advanced" },
    { word: "deter", meaning: "to discourage someone from doing something by instilling doubt or fear of the consequences. E.g., The high cost deterred him.", difficulty: "intermediate" },
    { word: "detrimental", meaning: "tending to cause harm. E.g., Smoking is detrimental to your health.", difficulty: "intermediate" },
    { word: "devious", meaning: "showing a skillful use of underhanded tactics to achieve goals; not direct. E.g., A devious politician. A devious route.", difficulty: "advanced" },
    { word: "devise", meaning: "to plan or invent a complex procedure, system, or mechanism by careful thought. E.g., He devised a new system for filing.", difficulty: "intermediate" },
    { word: "devoid", meaning: "entirely lacking or free from. E.g., The letter was devoid of warmth.", difficulty: "advanced" },
    { word: "devout", meaning: "having or showing deep religious feeling or commitment. E.g., A devout Muslim.", difficulty: "intermediate" },
    { word: "didactic", meaning: "intended to teach, particularly in having moral instruction as an ulterior motive. E.g., A didactic novel.", difficulty: "advanced" },
    { word: "diffident", meaning: "modest or shy because of a lack of self-confidence. E.g., A diffident young man.", difficulty: "advanced" },
    { word: "diffuse", meaning: "spread out over a large area; not concentrated; to spread or cause to spread over a wide area. E.g., Diffuse light. The problem is too diffuse. Technologies diffuse rapidly.", difficulty: "advanced" },
    { word: "diligent", meaning: "having or showing care and conscientiousness", difficulty: "intermediate" },
    { word: "diminutive", meaning: "extremely or unusually small. E.g., A diminutive figure.", difficulty: "advanced" },
    { word: "discern", meaning: "to perceive or recognize something. E.g., I could barely discern the shape in the fog.", difficulty: "intermediate" },
    { word: "discerning", meaning: "having or showing good judgment. E.g., A discerning critic.", difficulty: "advanced" },
    { word: "disconcert", meaning: "to disturb the composure of; to unsettle. E.g., She was disconcerted by his stare.", difficulty: "advanced" },
    { word: "discordant", meaning: "disagreeing or incongruous; harsh and unpleasant sounding. E.g., Discordant opinions. A discordant note.", difficulty: "advanced" },
    { word: "discredit", meaning: "to harm the good reputation of someone or something. E.g., The article discredited the theory.", difficulty: "intermediate" },
    { word: "discrepancy", meaning: "a lack of compatibility or similarity between two or more facts. E.g., There is a discrepancy between the two reports.", difficulty: "intermediate" },
    { word: "discrete", meaning: "individually separate and distinct. E.g., Several discrete sections.", difficulty: "advanced" },
    { word: "discretion", meaning: "the quality of behaving or speaking in such a way as to avoid causing offense or revealing private information; freedom to decide. E.g., This is a matter for your discretion.", difficulty: "intermediate" },
    { word: "discriminate", meaning: "to recognize a distinction; to differentiate; to make an unjust distinction in the treatment of different categories of people. E.g., The computer can discriminate between thousands of colors. It is illegal to discriminate on the basis of race.", difficulty: "intermediate" },
    { word: "disdain", meaning: "the feeling that someone or something is unworthy of one's consideration or respect; contempt. E.g., She looked at him with disdain.", difficulty: "advanced" },
    { word: "disingenuous", meaning: "not candid or sincere, typically by pretending that one knows less about something than one really does. E.g., A disingenuous statement.", difficulty: "advanced" },
    { word: "disinterested", meaning: "not influenced by considerations of personal advantage; impartial. E.g., A disinterested observer.", difficulty: "advanced" },
    { word: "dismantle", meaning: "to take a machine or structure to pieces. E.g., They dismantled the engine.", difficulty: "intermediate" },
    { word: "dismay", meaning: "consternation and distress, typically that caused by something unexpected. E.g., To my dismay, I failed the test.", difficulty: "intermediate" },
    { word: "disparage", meaning: "to represent as being of little worth; to belittle. E.g., He never missed an opportunity to disparage his rivals.", difficulty: "advanced" },
    { word: "disparate", meaning: "essentially different in kind; not allowing comparison. E.g., They inhabit disparate worlds.", difficulty: "advanced" },
    { word: "disparity", meaning: "a great difference. E.g., Economic disparities between the rich and poor.", difficulty: "intermediate" },
    { word: "dispatch", meaning: "to send off to a destination or for a purpose; to deal with a task quickly and efficiently. E.g., Dispatch a letter. He dispatched the task with ease.", difficulty: "intermediate" },
    { word: "disperse", meaning: "to distribute or spread over a wide area; to go in different directions. E.g., The crowd dispersed. Police dispersed the crowd.", difficulty: "intermediate" },
    { word: "disposition", meaning: "a person's inherent qualities of mind and character; natural tendency. E.g., She has a sunny disposition.", difficulty: "intermediate" },
    { word: "disputatious", meaning: "fond of or causing heated arguments. E.g., A disputatious politician.", difficulty: "advanced" },
    { word: "disseminate", meaning: "to spread something, especially information, widely. E.g., The news was disseminated quickly.", difficulty: "advanced" },
    { word: "dissent", meaning: "to hold or express opinions that are at variance with those previously, commonly, or officially expressed. E.g., Two members dissented from the majority.", difficulty: "intermediate" },
    { word: "dissident", meaning: "a person who opposes official policy, especially that of an authoritarian state. E.g., A political dissident.", difficulty: "advanced" },
    { word: "dissipate", meaning: "to disperse or scatter; to squander or fritter away. E.g., The fog dissipated. He dissipated his fortune.", difficulty: "advanced" },
    { word: "dissonance", meaning: "lack of harmony among musical notes; a tension or clash resulting from the combination of two disharmonious elements. E.g., Cognitive dissonance.", difficulty: "advanced" },
    { word: "dissuade", meaning: "to persuade someone not to take a particular course of action. E.g., I tried to dissuade him from leaving.", difficulty: "advanced" },
    { word: "distend", meaning: "to swell or cause to swell by pressure from inside. E.g., The abdomen distended.", difficulty: "advanced" },
    { word: "distill", meaning: "to extract the essential meaning or most important aspects of something. E.g., The report distills the main findings.", difficulty: "advanced" },
    { word: "distinct", meaning: "recognizably different in nature from something else; clear and definite. E.g., Two distinct types. A distinct possibility.", difficulty: "intermediate" },
    { word: "distinguish", meaning: "to recognize or treat as different; to manage to discern. E.g., It is hard to distinguish them apart. I can distinguish distant objects.", difficulty: "intermediate" },
    { word: "distort", meaning: "to pull or twist out of shape; to give a misleading account of. E.g., His face was distorted in anger. The article distorted the truth.", difficulty: "intermediate" },
    { word: "diverge", meaning: "to separate from another route and go in a different direction; to differ. E.g., The path diverges here. Their opinions diverged.", difficulty: "advanced" },
    { word: "divergent", meaning: "tending to be different or develop in different directions. E.g., Divergent interpretations.", difficulty: "advanced" },
    { word: "divulge", meaning: "to make known private or sensitive information. E.g., He refused to divulge the secret.", difficulty: "advanced" },
    { word: "doctrine", meaning: "a belief or set of beliefs held and taught by a church, political party, or other group. E.g., The doctrine of predestination.", difficulty: "intermediate" },
    { word: "document", meaning: "to record something in written, photographic, or other form. E.g., The book documents his travels.", difficulty: "intermediate" },
    { word: "dogma", meaning: "a principle or set of principles laid down by an authority as incontrovertibly true. E.g., Christian dogma.", difficulty: "advanced" },
    { word: "dogmatic", meaning: "inclined to lay down principles as undeniably true; opinionated. E.g., A dogmatic approach.", difficulty: "advanced" },
    { word: "dormant", meaning: "having normal physical functions suspended or slowed down for a period of time; in a state of rest. E.g., A dormant volcano.", difficulty: "intermediate" },
    { word: "dubious", meaning: "hesitating or doubting; not to be relied upon. E.g., I was dubious about his plans. A dubious character.", difficulty: "intermediate" },
    { word: "duplicity", meaning: "deceitfulness; double-dealing. E.g., She discovered his duplicity.", difficulty: "advanced" },
    { word: "durable", meaning: "able to withstand wear, pressure, or damage; hard-wearing. E.g., Durable goods.", difficulty: "intermediate" },
    { word: "dwindle", meaning: "to diminish gradually in size, amount, or strength. E.g., Their savings dwindled away.", difficulty: "intermediate" },
    { word: "dynamic", meaning: "characterized by constant change, activity, or progress; positive in attitude and full of energy. E.g., A dynamic economy. A dynamic speaker.", difficulty: "intermediate" },
    { word: "eccentric", meaning: "unconventional and slightly strange; not placed centrally or not having its axis placed centrally. E.g., An eccentric millionaire.", difficulty: "intermediate" },
    { word: "eclectic", meaning: "deriving ideas, style, or taste from a broad and diverse range of sources. E.g., An eclectic collection of music.", difficulty: "advanced" },
    { word: "eclipse", meaning: "to obscure or block out light; to surpass and make seem insignificant. E.g., The sun was eclipsed by the moon. His success eclipsed his brother's.", difficulty: "intermediate" },
    { word: "economical", meaning: "giving good value or service in relation to the amount of money, time, or effort spent; using no more of something than is necessary. E.g., An economical car. An economical use of space.", difficulty: "intermediate" },
    { word: "ecstasy", meaning: "an overwhelming feeling of great happiness or joyful excitement. E.g., She was in ecstasy over her new job.", difficulty: "intermediate" },
    { word: "edifice", meaning: "a large, imposing building. E.g., A vast edifice of stone.", difficulty: "advanced" },
    { word: "edify", meaning: "to instruct or improve someone morally or intellectually. E.g., An edifying experience.", difficulty: "advanced" },
    { word: "efface", meaning: "to erase a mark from a surface; to make oneself appear insignificant or inconspicuous. E.g., He could not efface the impression. She effaced herself from the conversation.", difficulty: "advanced" },
    { word: "effervescent", meaning: "vivacious and enthusiastic; giving off bubbles. E.g., An effervescent personality. Effervescent water.", difficulty: "advanced" },
    { word: "efficacious", meaning: "effective; producing the desired result. E.g., An efficacious remedy.", difficulty: "advanced" },
    { word: "efficient", meaning: "achieving maximum productivity with minimum wasted effort or expense. E.g., An efficient heating system.", difficulty: "intermediate" },
    { word: "effigy", meaning: "a sculpture or model of a person. E.g., They burned an effigy of the dictator.", difficulty: "advanced" },
    { word: "effrontery", meaning: "insolent or impertinent behavior. E.g., He had the effrontery to question my decision.", difficulty: "advanced" },
    { word: "effusive", meaning: "expressing feelings of gratitude, pleasure, or approval in an unrestrained or heartfelt manner. E.g., An effusive welcome.", difficulty: "advanced" },
    { word: "egregious", meaning: "outstandingly bad; shocking. E.g., An egregious error.", difficulty: "advanced" },
    { word: "elaborate", meaning: "involving many carefully arranged parts or details; detailed and complicated; to develop or present a theory or story in detail. E.g., An elaborate pattern. She elaborated on her plan.", difficulty: "intermediate" },
    { word: "elated", meaning: "ecstatically happy. E.g., He was elated at the news of his victory.", difficulty: "intermediate" },
    { word: "elegy", meaning: "a poem of serious reflection, typically a lament for the dead. E.g., He wrote an elegy for his friend.", difficulty: "advanced" },
    { word: "elicit", meaning: "to evoke or draw out a response or fact from someone. E.g., The question elicited a surprised gasp.", difficulty: "advanced" },
    { word: "eloquent", meaning: "fluent or persuasive in speaking or writing", difficulty: "advanced" },
    { word: "elucidate", meaning: "to make something clear; to explain. E.g., He elucidated the complex problem.", difficulty: "advanced" },
    { word: "elude", meaning: "to evade or escape from a danger, enemy, or pursuer, typically in a skillful or cunning way; to fail to be achieved by someone. E.g., The criminal eluded capture. Success eluded him.", difficulty: "advanced" },
    { word: "emaciated", meaning: "abnormally thin or weak, especially because of illness or a lack of food. E.g., An emaciated child.", difficulty: "advanced" },
    { word: "emanate", meaning: "to issue or spread out from a source. E.g., Heat emanated from the fire.", difficulty: "advanced" },
    { word: "emancipate", meaning: "to set free, especially from legal, social, or political restrictions. E.g., To emancipate the slaves.", difficulty: "advanced" },
    { word: "embellish", meaning: "to make something more attractive by the addition of decorative details or features; to make a story more interesting by adding extra details. E.g., A dress embellished with lace. He embellished the tale.", difficulty: "advanced" },
    { word: "embezzle", meaning: "to steal or misappropriate money placed in one's trust or belonging to one's employer. E.g., He embezzled thousands of dollars.", difficulty: "advanced" },
    { word: "embody", meaning: "to be an expression of or give a tangible or visible form to an idea, quality, or feeling; to include or contain. E.g., She embodies kindness. The law embodies a principle.", difficulty: "intermediate" },
    { word: "embrace", meaning: "to accept or support a belief, theory, or change willingly and enthusiastically; to hold someone closely in one's arms. E.g., They embraced new technology. They embraced each other.", difficulty: "intermediate" },
    { word: "eminent", meaning: "famous and respected within a particular sphere or profession. E.g., An eminent historian.", difficulty: "advanced" },
    { word: "emphatic", meaning: "showing or giving emphasis; expressing something forcibly and clearly. E.g., An emphatic denial.", difficulty: "intermediate" },
    { word: "empirical", meaning: "based on, concerned with, or verifiable by observation or experience rather than theory or pure logic. E.g., Empirical evidence.", difficulty: "advanced" },
    { word: "emulate", meaning: "to match or surpass a person or achievement, typically by imitation. E.g., She hoped to emulate her sister's success.", difficulty: "advanced" },
    { word: "enamor", meaning: "to be filled with a feeling of love for. E.g., He became enamored of her.", difficulty: "advanced" },
    { word: "encapsulate", meaning: "to express the essential features of something succinctly; to enclose in a capsule. E.g., The poem encapsulates the mood of the era.", difficulty: "advanced" },
    { word: "enchant", meaning: "to fill someone with great delight; to charm. E.g., The audience was enchanted by her singing.", difficulty: "intermediate" },
    { word: "encompass", meaning: "to surround and have or hold within; to include comprehensively. E.g., The course encompasses all aspects of the subject.", difficulty: "intermediate" },
    { word: "encounter", meaning: "to unexpectedly experience or be faced with something; a meeting, especially one that is unplanned. E.g., We encountered a problem. A chance encounter.", difficulty: "intermediate" },
    { word: "encroach", meaning: "to intrude on a person's territory, rights, etc. E.g., The sea is encroaching on the land.", difficulty: "advanced" },
    { word: "encumber", meaning: "to restrict or burden someone or something in such a way that free action or movement is difficult. E.g., She was encumbered by her heavy luggage.", difficulty: "advanced" },
    { word: "endorse", meaning: "to declare one's public approval or support of; to sign a check on the back to make it payable to someone else. E.g., He endorsed the product. Endorse the check.", difficulty: "intermediate" },
    { word: "endure", meaning: "to suffer something painful or difficult patiently; to remain in existence; last. E.g., He endured great pain. These traditions have endured for centuries.", difficulty: "intermediate" },
    { word: "energize", meaning: "to give energy and enthusiasm to. E.g., The speech energized the crowd.", difficulty: "intermediate" },
    { word: "enervate", meaning: "to cause someone to feel drained of energy or vitality; weaken. E.g., The hot sun enervated her.", difficulty: "advanced" },
    { word: "engender", meaning: "to cause or give rise to a feeling, situation, or condition. E.g., The letter engendered doubts in my mind.", difficulty: "advanced" },
    { word: "engross", meaning: "to absorb all the attention or interest of. E.g., She was engrossed in her book.", difficulty: "advanced" },
    { word: "enhance", meaning: "to intensify, increase, or further improve the quality, value, or extent of. E.g., The sauce enhances the flavor of the meat.", difficulty: "intermediate" },
    { word: "enigma", meaning: "a person or thing that is mysterious, puzzling, or difficult to understand. E.g., He remains an enigma.", difficulty: "advanced" },
    { word: "enlighten", meaning: "to give someone greater knowledge and understanding about a subject or situation. E.g., Can you enlighten me?", difficulty: "intermediate" },
    { word: "enmity", meaning: "the state or feeling of being actively opposed or hostile to someone or something. E.g., Decades of enmity between the two countries.", difficulty: "advanced" },
    { word: "ennui", meaning: "a feeling of listlessness and dissatisfaction arising from a lack of occupation or excitement. E.g., A sense of ennui pervaded the office.", difficulty: "advanced" },
    { word: "enormity", meaning: "the great or extreme scale, seriousness, or extent of something perceived as bad or morally wrong. E.g., The enormity of the crime.", difficulty: "intermediate" },
    { word: "enrapture", meaning: "to give intense pleasure or joy to. E.g., The audience was enraptured by the performance.", difficulty: "advanced" },
    { word: "ensue", meaning: "to happen or occur afterward or as a result. E.g., Chaos ensued.", difficulty: "advanced" },
    { word: "entail", meaning: "to involve something as a necessary or inevitable part or consequence. E.g., The job entails a lot of travel.", difficulty: "intermediate" },
    { word: "enthrall", meaning: "to capture the fascinated attention of. E.g., The story enthralled the children.", difficulty: "advanced" },
    { word: "entice", meaning: "to attract or tempt by offering pleasure or advantage. E.g., Advertisements designed to entice new customers.", difficulty: "intermediate" },
    { word: "entity", meaning: "a thing with distinct and independent existence. E.g., The company is a separate legal entity.", difficulty: "intermediate" },
    { word: "entomology", meaning: "the scientific study of insects. E.g., He has a degree in entomology.", difficulty: "advanced" },
    { word: "entourage", meaning: "a group of people attending or surrounding an important person. E.g., The president and his entourage.", difficulty: "intermediate" },
    { word: "entreat", meaning: "to ask someone earnestly or anxiously to do something. E.g., She entreated him to stay.", difficulty: "advanced" },
    { word: "enumerate", meaning: "to mention a number of things one by one. E.g., She enumerated the reasons for her decision.", difficulty: "advanced" },
    { word: "enunciate", meaning: "to say or pronounce clearly; to express a proposition, theory, etc. clearly. E.g., He enunciated each word carefully. She enunciated her philosophy.", difficulty: "advanced" },
    { word: "ephemeral", meaning: "lasting for a very short time. E.g., Ephemeral pleasures.", difficulty: "advanced" },
    { word: "epic", meaning: "a long poem, typically one derived from ancient oral tradition, narrating the deeds and adventures of heroic figures; grand in scale or character. E.g., Homer's 'Iliad' is an epic. An epic journey.", difficulty: "intermediate" },
    { word: "epicure", meaning: "a person who takes particular pleasure in fine food and drink. E.g., He was an epicure who loved gourmet meals.", difficulty: "advanced" },
    { word: "epigram", meaning: "a pithy saying or remark expressing an idea in a clever and amusing way. E.g., Oscar Wilde was famous for his epigrams.", difficulty: "advanced" },
    { word: "epitome", meaning: "a person or thing that is a perfect example of a particular quality or type. E.g., She is the epitome of elegance.", difficulty: "advanced" },
    { word: "equanimity", meaning: "mental calmness, composure, and evenness of temper, especially in a difficult situation. E.g., She accepted the news with equanimity.", difficulty: "advanced" },
    { word: "equivocal", meaning: "open to more than one interpretation; ambiguous and uncertain. E.g., An equivocal statement.", difficulty: "advanced" },
    { word: "eradicate", meaning: "to destroy completely; to put an end to. E.g., The disease has been eradicated.", difficulty: "intermediate" },
    { word: "erratic", meaning: "not even or regular in pattern or movement; unpredictable. E.g., Erratic behavior.", difficulty: "intermediate" },
    { word: "erroneous", meaning: "wrong; incorrect. E.g., An erroneous assumption.", difficulty: "intermediate" },
    { word: "erudite", meaning: "having or showing great knowledge or learning. E.g., An erudite scholar.", difficulty: "advanced" },
    { word: "escalate", meaning: "to increase rapidly; to become more intense or serious. E.g., The conflict escalated into war.", difficulty: "intermediate" },
    { word: "eschew", meaning: "to deliberately avoid using; to abstain from. E.g., He eschewed alcohol.", difficulty: "advanced" },
    { word: "esoteric", meaning: "intended for or likely to be understood by only a small number of people with a specialized knowledge or interest. E.g., Esoteric philosophical doctrines.", difficulty: "advanced" },
    { word: "espouse", meaning: "to adopt or support a cause, belief, or way of life. E.g., He espoused socialist ideals.", difficulty: "advanced" },
    { word: "esteem", meaning: "respect and admiration; to respect and admire. E.g., He was held in high esteem. I esteem him for his honesty.", difficulty: "intermediate" },
    { word: "ethereal", meaning: "extremely delicate and light in a way that seems too perfect for this world. E.g., Ethereal beauty.", difficulty: "advanced" },
    { word: "ethical", meaning: "relating to moral principles; morally good or correct. E.g., An ethical dilemma.", difficulty: "intermediate" },
    { word: "ethos", meaning: "the characteristic spirit of a culture, era, or community as manifested in its beliefs and aspirations. E.g., The revolutionary ethos.", difficulty: "advanced" },
    { word: "eulogy", meaning: "a speech or piece of writing that praises someone or something highly, typically someone who has just died. E.g., He gave a moving eulogy at the funeral.", difficulty: "advanced" },
    { word: "euphemism", meaning: "a mild or indirect word or expression substituted for one considered to be too harsh or blunt. E.g., 'Passed away' is a euphemism for 'died'.", difficulty: "advanced" },
    { word: "euphoria", meaning: "a feeling or state of intense excitement and happiness. E.g., A sense of euphoria followed the victory.", difficulty: "intermediate" },
    { word: "evade", meaning: "to escape or avoid, especially by cleverness or trickery. E.g., He evaded the question.", difficulty: "intermediate" },
    { word: "evanescent", meaning: "soon passing out of sight, memory, or existence; quickly fading or disappearing. E.g., Evanescent memories.", difficulty: "advanced" },
    { word: "evasive", meaning: "tending to avoid commitment or self-revelation, especially by responding only indirectly. E.g., An evasive answer.", difficulty: "intermediate" },
    { word: "evoke", meaning: "to bring or recall a feeling, memory, or image to the conscious mind. E.g., The smell evoked memories of her childhood.", difficulty: "intermediate" },
    { word: "exacerbate", meaning: "to make a problem, bad situation, or negative feeling worse. E.g., His comments exacerbated the tension.", difficulty: "advanced" },
    { word: "exalt", meaning: "to hold someone or something in very high regard; think or speak very highly of; to raise to a higher rank or position. E.g., They exalted their hero. He was exalted to the position of CEO.", difficulty: "advanced" },
    { word: "exasperate", meaning: "to irritate intensely; infuriate. E.g., His constant complaining exasperated me.", difficulty: "intermediate" },
    { word: "excavate", meaning: "to make a hole or channel by digging; to dig out material from the ground; to extract material from the ground by digging. E.g., They excavated the ancient city.", difficulty: "intermediate" },
    { word: "exceptional", meaning: "unusual; not typical; unusually good; outstanding. E.g., Exceptional circumstances. An exceptional student.", difficulty: "intermediate" },
    { word: "excerpt", meaning: "a short extract from a film, broadcast, or piece of music or writing. E.g., She read an excerpt from the novel.", difficulty: "intermediate" },
    { word: "exhilarating", meaning: "making one feel very happy, animated, or elated; thrilling. E.g., An exhilarating experience.", difficulty: "intermediate" },
    { word: "exonerate", meaning: "to absolve someone from blame for a fault or wrongdoing, especially after due consideration of the case. E.g., The evidence exonerated the suspect.", difficulty: "advanced" },
    { word: "exorbitant", meaning: "unreasonably high. E.g., An exorbitant price.", difficulty: "advanced" },
    { word: "expedient", meaning: "convenient and practical, although possibly improper or immoral; a means of attaining an end. E.g., An expedient solution. A necessary expedient.", difficulty: "advanced" },
    { word: "expedite", meaning: "to make an action or process happen sooner or be accomplished more quickly. E.g., He promised to expedite the delivery.", difficulty: "advanced" },
    { word: "explicit", meaning: "stated clearly and in detail, leaving no room for confusion or doubt. E.g., Explicit instructions.", difficulty: "intermediate" },
    { word: "exploit", meaning: "to make full use of and derive benefit from a resource; to use a situation or person in an unfair or selfish way. E.g., We need to exploit this opportunity. To exploit workers.", difficulty: "intermediate" },
    { word: "extol", meaning: "to praise enthusiastically. E.g., He extolled the virtues of the new system.", difficulty: "advanced" },
    { word: "extraneous", meaning: "irrelevant or unrelated to the subject being dealt with. E.g., Please exclude extraneous details.", difficulty: "advanced" },
    { word: "extricate", meaning: "to free someone or something from a constraint or difficulty. E.g., He extricated himself from the situation.", difficulty: "advanced" },
    { word: "exuberant", meaning: "filled with or characterized by a lively energy and excitement. E.g., An exuberant personality.", difficulty: "advanced" },
    { word: "fabricate", meaning: "to invent or concoct something, typically with deceitful intent; to construct or manufacture an industrial product. E.g., He fabricated the whole story. The company fabricates steel.", difficulty: "intermediate" },
    { word: "facilitate", meaning: "to make an action or process easy or easier. E.g., The software facilitates data analysis.", difficulty: "intermediate" },
    { word: "facsimile", meaning: "an exact copy, especially of written or printed material. E.g., A facsimile of the document.", difficulty: "advanced" },
    { word: "fallacy", meaning: "a mistaken belief, especially one based on unsound argument. E.g., The notion is a complete fallacy.", difficulty: "intermediate" },
    { word: "falter", meaning: "to start to lose strength or momentum; to speak hesitantly. E.g., The economy is faltering. His voice faltered.", difficulty: "advanced" },
    { word: "famine", meaning: "extreme scarcity of food. E.g., A severe famine struck the region.", difficulty: "intermediate" },
    { word: "fanatic", meaning: "a person filled with excessive and single-minded zeal, especially for an extreme religious or political cause. E.g., A religious fanatic.", difficulty: "intermediate" },
    { word: "fastidious", meaning: "very attentive to and concerned about accuracy and detail; very concerned about matters of cleanliness. E.g., A fastidious editor. He was fastidious about his appearance.", difficulty: "advanced" },
    { word: "fathom", meaning: "to understand a difficult problem or mysterious person after much thought. E.g., I cannot fathom his motives.", difficulty: "intermediate" },
    { word: "feasible", meaning: "possible to do easily or conveniently. E.g., A feasible plan.", difficulty: "intermediate" },
    { word: "feign", meaning: "to pretend to be affected by a feeling, state, or injury. E.g., She feigned illness.", difficulty: "advanced" },
    { word: "felicity", meaning: "intense happiness; the ability to find appropriate expression for one's thoughts. E.g., She expressed herself with felicity.", difficulty: "advanced" },
    { word: "fervent", meaning: "having or displaying a passionate intensity. E.g., A fervent belief.", difficulty: "advanced" },
    { word: "fickle", meaning: "changing frequently, especially as regards one's loyalties, interests, or affection. E.g., A fickle friend.", difficulty: "advanced" },
    { word: "fidelity", meaning: "faithfulness to a person, cause, or belief, demonstrated by continuing loyalty and support; the degree of exactness with which something is copied or reproduced. E.g., Marital fidelity. High fidelity sound.", difficulty: "advanced" },
    { word: "figurative", meaning: "departing from a literal use of words; metaphorical. E.g., Figurative language.", difficulty: "intermediate" },
    { word: "finite", meaning: "having limits or bounds. E.g., The Earth's resources are finite.", difficulty: "intermediate" },
    { word: "flagrant", meaning: "conspicuously or obviously offensive. E.g., A flagrant violation of the rules.", difficulty: "advanced" },
    { word: "flamboyant", meaning: "tending to attract attention because of their exuberance, confidence, and stylishness. E.g., A flamboyant personality.", difficulty: "advanced" },
    { word: "flaunt", meaning: "to display ostentatiously. E.g., She flaunted her wealth.", difficulty: "intermediate" },
    { word: "fledgling", meaning: "a young bird that has just fledged; a person or organization that is immature, inexperienced, or underdeveloped. E.g., A fledgling company.", difficulty: "advanced" },
    { word: "florid", meaning: "having a red or flushed complexion; excessively intricate or elaborate. E.g., A florid style of writing.", difficulty: "advanced" },
    { word: "flourish", meaning: "to grow or develop in a healthy or vigorous way; to wave something to attract attention. E.g., The arts flourished. He flourished the document.", difficulty: "intermediate" },
    { word: "fluctuate", meaning: "to rise and fall irregularly in number or amount. E.g., Prices have fluctuated.", difficulty: "intermediate" },
    { word: "forbearance", meaning: "patient self-control; restraint and tolerance. E.g., He showed great forbearance.", difficulty: "advanced" },
    { word: "foreboding", meaning: "a feeling that something bad will happen; fearful apprehension. E.g., A sense of foreboding.", difficulty: "advanced" },
    { word: "forestall", meaning: "to prevent or obstruct an anticipated event or action by taking advance action. E.g., They forestalled the attempt.", difficulty: "advanced" },
    { word: "forlorn", meaning: "pitifully sad and abandoned or lonely. E.g., A forlorn expression.", difficulty: "advanced" },
    { word: "formidable", meaning: "inspiring fear or respect through being impressively large, powerful, intense, or capable. E.g., A formidable opponent.", difficulty: "intermediate" },
    { word: "fortitude", meaning: "courage in pain or adversity. E.g., She bore her illness with great fortitude.", difficulty: "advanced" },
    { word: "fortuitous", meaning: "happening by accident or chance rather than design; lucky. E.g., A fortuitous meeting.", difficulty: "advanced" },
    { word: "foster", meaning: "to encourage or promote the development of something; to bring up a child that is not one's own by birth. E.g., To foster good relations. A foster parent.", difficulty: "intermediate" },
    { word: "fracas", meaning: "a noisy disturbance or quarrel. E.g., A fracas broke out in the bar.", difficulty: "advanced" },
    { word: "fragile", meaning: "easily broken or damaged; delicate and vulnerable. E.g., Fragile china. A fragile economy.", difficulty: "intermediate" },
    { word: "frantic", meaning: "wild or distraught with fear, anxiety, or other emotion. E.g., Frantic efforts to save him.", difficulty: "intermediate" },
    { word: "fraudulent", meaning: "obtained, done by, or involving deception, typically for personal or financial gain. E.g., Fraudulent claims.", difficulty: "intermediate" },
    { word: "frenetic", meaning: "fast and energetic in a rather wild and uncontrolled way. E.g., A frenetic pace of activity.", difficulty: "advanced" },
    { word: "frugal", meaning: "sparing or economical with regard to money or food; simple and plain and costing little. E.g., A frugal meal.", difficulty: "intermediate" },
    { word: "frustrate", meaning: "to prevent a plan or action from progressing or succeeding; to cause someone to feel upset or annoyed. E.g., He was frustrated by the delay.", difficulty: "intermediate" },
    { word: "futile", meaning: "incapable of producing any useful result; pointless. E.g., A futile attempt.", difficulty: "intermediate" },
    { word: "garrulous", meaning: "excessively talkative, especially on trivial matters. E.g., A garrulous old man.", difficulty: "advanced" },
    { word: "gaudy", meaning: "extravagantly bright or showy, typically so as to be tasteless. E.g., Gaudy jewelry.", difficulty: "advanced" },
    { word: "genial", meaning: "friendly and cheerful. E.g., A genial host.", difficulty: "intermediate" },
    { word: "germane", meaning: "relevant to a subject under consideration. E.g., That point is not germane to our discussion.", difficulty: "advanced" },
    { word: "glib", meaning: "fluent and voluble but insincere and shallow. E.g., A glib talker.", difficulty: "advanced" },
    { word: "gloat", meaning: "to contemplate or dwell on one's own success or another's misfortune with smugness or malignant pleasure. E.g., He gloated over his rival's failure.", difficulty: "advanced" },
    { word: "gregarious", meaning: "fond of the company of others; sociable", difficulty: "advanced" },
    { word: "grievous", meaning: "very severe or serious. E.g., A grievous error.", difficulty: "advanced" },
    { word: "guile", meaning: "sly or cunning intelligence. E.g., He used guile to get what he wanted.", difficulty: "advanced" },
    { word: "hackneyed", meaning: "lacking significance through having been overused; unoriginal and trite. E.g., A hackneyed phrase.", difficulty: "advanced" },
    { word: "haphazard", meaning: "lacking any obvious principle of organization; random. E.g., A haphazard arrangement.", difficulty: "intermediate" },
    { word: "harangue", meaning: "a lengthy and aggressive speech; to lecture someone at length in an aggressive and critical manner. E.g., He delivered a harangue against the government.", difficulty: "advanced" },
    { word: "harass", meaning: "to subject to aggressive pressure or intimidation. E.g., She was harassed by phone calls.", difficulty: "intermediate" },
    { word: "harbinger", meaning: "a person or thing that announces or signals the approach of another. E.g., The cuckoo is a harbinger of spring.", difficulty: "advanced" },
    { word: "harrowing", meaning: "acutely distressing. E.g., A harrowing experience.", difficulty: "intermediate" },
    { word: "haughty", meaning: "arrogantly superior and disdainful. E.g., A haughty aristocrat.", difficulty: "advanced" },
    { word: "hedonist", meaning: "a person who believes that the pursuit of pleasure is the most important thing in life. E.g., A dedicated hedonist.", difficulty: "advanced" },
    { word: "heed", meaning: "to pay attention to; to take notice of. E.g., He refused to heed my warnings.", difficulty: "intermediate" },
    { word: "heinous", meaning: "utterly odious or wicked. E.g., A heinous crime.", difficulty: "advanced" },
    { word: "heresy", meaning: "belief or opinion contrary to orthodox religious doctrine. E.g., He was accused of heresy.", difficulty: "advanced" },
    { word: "hiatus", meaning: "a pause or gap in a sequence, series, or process. E.g., There was a hiatus in his career.", difficulty: "advanced" },
    { word: "hierarchy", meaning: "a system or organization in which people or groups are ranked one above the other according to status or authority. E.g., A social hierarchy.", difficulty: "intermediate" },
    { word: "hinder", meaning: "to create difficulties for someone or something, resulting in delay or obstruction. E.g., This could hinder the progress of the project.", difficulty: "intermediate" },
    { word: "hoard", meaning: "a stock or store of money or valued objects, typically one that is secret or carefully guarded; to amass and hide or store away. E.g., A dragon's hoard. He hoarded food.", difficulty: "intermediate" },
    { word: "homogeneous", meaning: "of the same kind; alike. E.g., A homogeneous population.", difficulty: "advanced" },
    { word: "hone", meaning: "to sharpen a blade; to refine or perfect something over a period of time. E.g., He honed his skills to perfection.", difficulty: "intermediate" },
    { word: "hostile", meaning: "unfriendly; antagonistic. E.g., A hostile crowd.", difficulty: "intermediate" },
    { word: "hubris", meaning: "excessive pride or self-confidence. E.g., His hubris led to his downfall.", difficulty: "advanced" },
    { word: "humane", meaning: "having or showing compassion or benevolence. E.g., Humane treatment of animals.", difficulty: "intermediate" },
    { word: "humility", meaning: "a modest or low view of one's own importance; humbleness. E.g., He accepted the award with humility.", difficulty: "intermediate" },
    { word: "hypocrisy", meaning: "the practice of claiming to have moral standards or beliefs to which one's own behavior does not conform; pretense. E.g., The hypocrisy of his actions was obvious.", difficulty: "intermediate" },
    { word: "hypothesis", meaning: "a supposition made as a starting point for investigation", difficulty: "intermediate" },
    { word: "iconoclast", meaning: "a person who attacks cherished beliefs or institutions. E.g., A religious iconoclast.", difficulty: "advanced" },
    { word: "idealist", meaning: "a person who is guided more by ideals than by practical considerations. E.g., He was a young idealist.", difficulty: "intermediate" },
    { word: "idiosyncrasy", meaning: "a mode of behavior or way of thought peculiar to an individual. E.g., One of his little idiosyncrasies.", difficulty: "advanced" },
    { word: "idle", meaning: "avoiding work; lazy; without purpose or effect; pointless. E.g., An idle worker. An idle threat.", difficulty: "intermediate" },
    { word: "ignominious", meaning: "deserving or causing public disgrace or shame. E.g., An ignominious defeat.", difficulty: "advanced" },
    { word: "illuminate", meaning: "light up or brighten with light", difficulty: "intermediate" },
    { word: "illusory", meaning: "based on illusion; not real. E.g., Illusory promises.", difficulty: "advanced" },
    { word: "illustrious", meaning: "well known, respected, and admired for past achievements. E.g., An illustrious career.", difficulty: "advanced" },
    { word: "imbue", meaning: "to inspire or permeate with a feeling or quality. E.g., His works are imbued with a sense of hope.", difficulty: "advanced" },
    { word: "immaculate", meaning: "perfectly clean, neat, or tidy; free from flaws or mistakes; perfect. E.g., An immaculate uniform. Immaculate timing.", difficulty: "intermediate" },
    { word: "immerse", meaning: "to dip or submerge in a liquid; to involve oneself deeply in a particular activity or interest. E.g., Immerse the cloth in the dye. She immersed herself in her work.", difficulty: "intermediate" },
    { word: "immutable", meaning: "unchanging over time or unable to be changed. E.g., An immutable law.", difficulty: "advanced" },
    { word: "impair", meaning: "to weaken or damage something, especially a human faculty or function. E.g., The drug can impair your judgment.", difficulty: "intermediate" },
    { word: "impartial", meaning: "treating all rivals or disputants equally; fair and just. E.g., An impartial judge.", difficulty: "intermediate" },
    { word: "impeccable", meaning: "in accordance with the highest standards; faultless. E.g., Impeccable manners.", difficulty: "advanced" },
    { word: "impede", meaning: "to delay or prevent someone or something by obstructing them; hinder. E.g., The bad weather impeded our progress.", difficulty: "intermediate" },
    { word: "imperative", meaning: "of vital importance; crucial; giving an authoritative command. E.g., It is imperative that we act now. An imperative tone.", difficulty: "intermediate" },
    { word: "imperious", meaning: "assuming power or authority without justification; arrogant and domineering. E.g., An imperious manner.", difficulty: "advanced" },
    { word: "impermeable", meaning: "not allowing fluid to pass through. E.g., An impermeable membrane.", difficulty: "advanced" },
    { word: "impertinent", meaning: "not showing proper respect; rude. E.g., An impertinent question.", difficulty: "advanced" },
    { word: "impetuous", meaning: "acting or done quickly and without thought or care. E.g., An impetuous decision.", difficulty: "advanced" },
    { word: "implacable", meaning: "unable to be appeased or placated. E.g., Implacable hostility.", difficulty: "advanced" },
    { word: "implement", meaning: "to put a decision, plan, agreement, etc. into effect. E.g., The policy was implemented last year.", difficulty: "intermediate" },
    { word: "implicate", meaning: "to show someone to be involved in a crime; to convey a meaning indirectly. E.g., The evidence implicates him in the robbery.", difficulty: "intermediate" },
    { word: "implicit", meaning: "implied though not plainly expressed; without reservation; absolute. E.g., Implicit criticism. Implicit trust.", difficulty: "intermediate" },
    { word: "implore", meaning: "to beg someone earnestly or desperately to do something. E.g., She implored him to stay.", difficulty: "advanced" },
    { word: "imposing", meaning: "grand and impressive in appearance. E.g., An imposing building.", difficulty: "intermediate" },
    { word: "impoverished", meaning: "made poor; deprived of strength or vitality. E.g., An impoverished nation. An impoverished soil.", difficulty: "intermediate" },
    { word: "impromptu", meaning: "done without being planned, organized, or rehearsed. E.g., An impromptu speech.", difficulty: "intermediate" },
    { word: "improvise", meaning: "to create and perform music, drama, or verse spontaneously or without preparation; to make from whatever is available. E.g., He improvised a song. We improvised a shelter.", difficulty: "intermediate" },
    { word: "impudent", meaning: "not showing due respect for another person; impertinent. E.g., An impudent child.", difficulty: "advanced" },
    { word: "inadvertent", meaning: "not resulting from or achieved through deliberate planning; unintentional. E.g., An inadvertent mistake.", difficulty: "advanced" },
    { word: "inalienable", meaning: "unable to be taken away from or given away by the possessor. E.g., Inalienable rights.", difficulty: "advanced" },
    { word: "inane", meaning: "silly; stupid. E.g., Inane chatter.", difficulty: "advanced" },
    { word: "inanimate", meaning: "not alive, especially not in the manner of animals and humans; showing no sign of life; lifeless. E.g., Inanimate objects.", difficulty: "intermediate" },
    { word: "inaugurate", meaning: "to begin or introduce a system, policy, or period; to admit someone formally to office. E.g., The new policy was inaugurated. The president was inaugurated.", difficulty: "advanced" },
    { word: "incense", meaning: "to make very angry. E.g., He was incensed by the decision.", difficulty: "advanced" },
    { word: "incentive", meaning: "a thing that motivates or encourages one to do something. E.g., A financial incentive.", difficulty: "intermediate" },
    { word: "incessant", meaning: "continuing without interruption; ceaseless. E.g., Incessant noise.", difficulty: "intermediate" },
    { word: "incidental", meaning: "occurring as a minor accompaniment or by chance; not essential. E.g., Incidental expenses.", difficulty: "intermediate" },
    { word: "incisive", meaning: "intelligently analytical and clear-thinking; sharp and direct. E.g., An incisive comment.", difficulty: "advanced" },
    { word: "incite", meaning: "to encourage or stir up violent or unlawful behavior. E.g., They were accused of inciting a riot.", difficulty: "intermediate" },
    { word: "inclined", meaning: "disposed or willing; having a tendency. E.g., I'm inclined to believe you. He's inclined to be lazy.", difficulty: "intermediate" },
    { word: "incoherent", meaning: "expressed in an incomprehensible or confusing way; unclear. E.g., Incoherent ramblings.", difficulty: "intermediate" },
    { word: "incompatible", meaning: "of two things so different in nature as to be incapable of existing together. E.g., Incompatible personalities.", difficulty: "intermediate" },
    { word: "inconsequential", meaning: "not important or significant. E.g., An inconsequential detail.", difficulty: "advanced" },
    { word: "incontrovertible", meaning: "not able to be denied or disputed. E.g., Incontrovertible proof.", difficulty: "advanced" },
    { word: "incorporate", meaning: "to take in or contain something as part of a whole; to include. E.g., The new car incorporates many safety features.", difficulty: "intermediate" },
    { word: "incorrigible", meaning: "not able to be corrected, improved, or reformed. E.g., An incorrigible optimist.", difficulty: "advanced" },
    { word: "incredulous", meaning: "unwilling or unable to believe something. E.g., An incredulous stare.", difficulty: "intermediate" },
    { word: "increment", meaning: "an increase or addition, especially one of a series on a fixed scale. E.g., Salary increments.", difficulty: "intermediate" },
    { word: "incumbent", meaning: "necessary for someone as a duty or responsibility; currently holding office. E.g., It is incumbent upon us to help. The incumbent president.", difficulty: "advanced" },
    { word: "indefatigable", meaning: "persisting tirelessly. E.g., An indefatigable campaigner.", difficulty: "advanced" },
    { word: "indelible", meaning: "making marks that cannot be removed; not able to be forgotten. E.g., Indelible ink. An indelible impression.", difficulty: "advanced" },
    { word: "indigenous", meaning: "originating or occurring naturally in a particular place; native. E.g., Indigenous plants.", difficulty: "intermediate" },
    { word: "indignant", meaning: "feeling or showing anger or annoyance at what is perceived as unfair treatment. E.g., She was indignant at the suggestion.", difficulty: "intermediate" },
    { word: "indiscriminate", meaning: "done at random or without careful judgment. E.g., Indiscriminate violence.", difficulty: "advanced" },
    { word: "indolent", meaning: "wanting to avoid activity or exertion; lazy. E.g., An indolent teenager.", difficulty: "advanced" },
    { word: "indomitable", meaning: "impossible to subdue or defeat. E.g., Indomitable courage.", difficulty: "advanced" },
    { word: "induce", meaning: "to succeed in persuading or influencing someone to do something; to bring about or give rise to. E.g., Nothing would induce me to go. The drug induces sleep.", difficulty: "intermediate" },
    { word: "indulgent", meaning: "having or indicating a tendency to be overly generous to or lenient with someone. E.g., An indulgent parent.", difficulty: "intermediate" },
    { word: "ineffable", meaning: "too great or extreme to be expressed or described in words. E.g., Ineffable joy.", difficulty: "advanced" },
    { word: "ineluctable", meaning: "unable to be resisted or avoided; inescapable. E.g., The ineluctable passage of time.", difficulty: "advanced" },
    { word: "inept", meaning: "having or showing no skill; clumsy. E.g., An inept remark.", difficulty: "intermediate" },
    { word: "inert", meaning: "lacking the ability or strength to move; chemically inactive. E.g., An inert gas.", difficulty: "advanced" },
    { word: "inevitable", meaning: "certain to happen; unavoidable. E.g., War was inevitable.", difficulty: "intermediate" },
    { word: "inexorable", meaning: "impossible to stop or prevent; relentless. E.g., Inexorable progress.", difficulty: "advanced" },
    { word: "infallible", meaning: "incapable of making mistakes or being wrong. E.g., No one is infallible.", difficulty: "intermediate" },
    { word: "infamous", meaning: "well known for some bad quality or deed. E.g., An infamous criminal.", difficulty: "intermediate" },
    { word: "infer", meaning: "to deduce or conclude information from evidence and reasoning rather than from explicit statements. E.g., From his tone, I inferred that he was angry.", difficulty: "intermediate" },
    { word: "infiltrate", meaning: "to enter or gain access to an organization or place surreptitiously and gradually, especially in order to acquire secret information. E.g., The spy infiltrated the government.", difficulty: "intermediate" },
    { word: "infinitesimal", meaning: "extremely small. E.g., An infinitesimal amount.", difficulty: "advanced" },
    { word: "infringe", meaning: "to actively break the terms of a law or agreement; to act so as to limit or undermine something. E.g., They infringed the copyright. This infringes on my privacy.", difficulty: "intermediate" },
    { word: "ingenious", meaning: "clever, original, and inventive. E.g., An ingenious device.", difficulty: "intermediate" },
    { word: "ingenuous", meaning: "innocent and unsuspecting; artless. E.g., An ingenuous young woman.", difficulty: "advanced" },
    { word: "inherent", meaning: "existing in something as a permanent, essential, or characteristic attribute. E.g., The risks inherent in investing.", difficulty: "intermediate" },
    { word: "inhibit", meaning: "to hinder, restrain, or prevent an action or process. E.g., Fear can inhibit learning.", difficulty: "intermediate" },
    { word: "inimical", meaning: "tending to obstruct or harm; unfriendly; hostile. E.g., Actions inimical to peace.", difficulty: "advanced" },
    { word: "iniquitous", meaning: "grossly unfair and morally wrong. E.g., An iniquitous tax.", difficulty: "advanced" },
    { word: "initiate", meaning: "to cause a process or action to begin; to admit someone into a secret or obscure society or group. E.g., He initiated the discussion. She was initiated into the club.", difficulty: "intermediate" },
    { word: "inject", meaning: "to introduce a new or different element into something. E.g., To inject humor into a situation.", difficulty: "intermediate" },
    { word: "innate", meaning: "inborn; natural. E.g., Innate ability.", difficulty: "intermediate" },
    { word: "innocuous", meaning: "not harmful or offensive. E.g., An innocuous comment.", difficulty: "advanced" },
    { word: "innovate", meaning: "to make changes in something established, especially by introducing new methods, ideas, or products. E.g., The company continues to innovate.", difficulty: "intermediate" },
    { word: "innuendo", meaning: "an allusive or oblique remark or hint, typically a suggestive or disparaging one. E.g., Sexual innuendo.", difficulty: "advanced" },
    { word: "inopportune", meaning: "occurring at an inconvenient or inappropriate time. E.g., An inopportune visit.", difficulty: "advanced" },
    { word: "insatiable", meaning: "impossible to satisfy. E.g., An insatiable appetite.", difficulty: "advanced" },
    { word: "inscrutable", meaning: "impossible to understand or interpret. E.g., An inscrutable smile.", difficulty: "advanced" },
    { word: "insidious", meaning: "proceeding in a gradual, subtle way, but with harmful effects. E.g., An insidious disease.", difficulty: "advanced" },
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
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById('budgetForm');
    const expenseList = document.getElementById('expenseList');

    // Load saved expenses on page load
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    renderExpenses();

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const category = document.getElementById('expenseCategory').value.trim();
            const amount = parseFloat(document.getElementById('expenseAmount').value.trim());
            const description = document.getElementById('expenseDescription').value.trim();

            if (!category || isNaN(amount) || amount <= 0) {
                alert("Please enter a valid category and a positive amount.");
                return;
            }

            // Create expense object
            const expense = {
                id: Date.now(),
                category,
                amount,
                description
            };

            // Save expense
            expenses.push(expense);
            localStorage.setItem('expenses', JSON.stringify(expenses));

            // Update UI
            renderExpenses();

            form.reset();
        });
    }

    function renderExpenses() {
        expenseList.innerHTML = "";

        if (expenses.length === 0) {
            expenseList.innerHTML = "<p>No expenses yet.</p>";
            return;
        }

        expenses.forEach(expense => {
            const li = document.createElement("li");
            li.innerHTML = `
                <strong>${expense.category}</strong> - ₦${expense.amount.toFixed(2)} 
                <em>${expense.description || "No description"}</em>
                <button data-id="${expense.id}" class="deleteBtn">❌</button>
            `;
            expenseList.appendChild(li);
        });

        // Delete functionality
        document.querySelectorAll(".deleteBtn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                expenses = expenses.filter(exp => exp.id != id);
                localStorage.setItem("expenses", JSON.stringify(expenses));
                renderExpenses();
            });
        });
    }
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