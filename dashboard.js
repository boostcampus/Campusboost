// =====================================================================
// 1. CONFIGURATION & IMPORTS
// =====================================================================

// --- Imports (UPDATED to latest stable version 10.12.2) ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    getFirestore, doc, getDoc, updateDoc, collection, 
    addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Firebase Configuration (CRITICAL: KEEP YOUR API KEY PRIVATE) ---
const firebaseConfig = {
    apiKey: "AIzaSyAEFnSKxmuxZ3JKHacGn3iMzps6yuwCS0E", // <-- REPLACE WITH YOUR REAL KEY
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

// --- Global Constants & State ---
// CRITICAL: REPLACE THIS WITH YOUR ACTUAL LIVE FLUTTERWAVE PUBLIC KEY
const FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK-b144c0c07294bbc6f4b3ac884960f766-X"; 
const PREMIUM_PRICE_NGN = 1000;
const TRIAL_DAYS = 30;

let currentUser = null;
let userIsPremium = false;
let timerInterval = null;
let pomodoroInterval = null;
let stopwatchInterval = null;

// =====================================================================
// 2. AUTHENTICATION & CORE USER DATA MANAGEMENT
// =====================================================================

/**
 * Loads user data, updates UI, and determines premium status.
 * @param {import('firebase/auth').User} user - The authenticated Firebase user object.
 */
async function loadUserData(user) {
    if (!user) return;
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let userData = userDoc.data() || {};
        
        // Ensure a profile exists (basic fallback)
        if (!userDoc.exists()) {
             // Create a minimal document if it doesn't exist
             await updateDoc(userDocRef, {
                 fullName: user.email.split('@')[0],
                 createdAt: serverTimestamp(),
                 isTrialUser: true,
                 isPremium: false,
                 cgpa: '0.00'
             }, { merge: true });
             userData = (await getDoc(userDocRef)).data(); // Reload data
        }

        // --- UI Initialization ---
        const fullName = userData.fullName || user.email.split('@')[0];
        document.getElementById('userName').textContent = fullName;
        document.getElementById('dashboardUserName').textContent = fullName;
        
        // Update dashboard stats (use nullish coalescing for safety)
        document.getElementById('currentCGPA').textContent = userData.cgpa || '0.00';
        document.getElementById('studyHours').textContent = userData.studyHours?.toString() || '0';
        document.getElementById('itemsSold').textContent = userData.itemsSold?.toString() || '0';
        document.getElementById('totalEarnings').textContent = `₦${(userData.totalEarnings || 0).toLocaleString()}`;

        // --- Premium Status Logic ---
        const premiumExpiry = userData.premiumExpiry?.toDate();
        const now = new Date();
        const isPaidPremium = premiumExpiry && premiumExpiry > now;
        
        const accountCreated = userData.createdAt?.toDate() || new Date(user.metadata.creationTime);
        const trialEnd = new Date(accountCreated.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000));
        const isTrialActive = trialEnd && now < trialEnd && userData.isTrialUser !== false; // Check for explicit opt-out of trial

        userIsPremium = isPaidPremium || isTrialActive;

        // --- UI Updates based on Premium Status ---
        const premiumBadge = document.getElementById('premiumBadge');
        const premiumAlert = document.getElementById('premiumAlert');

        premiumBadge?.classList.toggle('d-none', !userIsPremium);
        premiumAlert?.classList.add('d-none');
        
        if (isTrialActive && !isPaidPremium) {
            // Show trial alert for active trial users
            const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
            premiumAlert?.classList.remove('d-none');
            document.getElementById('trialDays').textContent = daysLeft + ' days';
        } else if (isPaidPremium) {
            // Optionally show paid premium expiry info
        }
        
        // Apply lock/unlock UI to features
        updatePremiumFeatures();
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

/**
 * Applies visual locks and payment prompts to premium features (links and sections).
 */
function updatePremiumFeatures() {
    const premiumElements = document.querySelectorAll('.premium-feature');
    
    premiumElements.forEach(element => {
        // Find existing lock icon
        let lockSpan = element.querySelector('.lock-icon');

        if (!userIsPremium) {
            // LOCK UI: Dim and add lock icon
            element.classList.add('text-muted', 'locked');
            element.style.opacity = '0.6';
            element.style.cursor = 'pointer';

            if (!lockSpan) {
                lockSpan = document.createElement('span');
                lockSpan.className = 'lock-icon ms-2';
                lockSpan.innerHTML = '🔒';
                element.appendChild(lockSpan);
            }

            // Remove existing listener to prevent stacking (if it was a link)
            element.onclick = null; 

            // Add click listener to show payment modal
            element.addEventListener('click', function handler(e) {
                e.preventDefault();
                e.stopPropagation();
                showPayment();
            }, true); // Use true for capture phase to ensure it runs before any other click
            
        } else {
            // UNLOCK UI: Restore appearance and remove lock icon
            element.classList.remove('text-muted', 'locked');
            element.style.opacity = '1';
            element.style.cursor = 'default';

            if (lockSpan) lockSpan.remove();

            // Remove the payment listener
            element.removeEventListener('click', showPayment, true);
        }
    });
}


// --- Authentication State Listener ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user);
        loadTasks(); 
        checkPendingPayments(); // Check for any payments completed while logged out/refreshing
    } else {
        window.location.href = 'register.html';
    }
});

// =====================================================================
// 3. NAVIGATION & LOGOUT
// =====================================================================

/**
 * Global function to switch sections (called from HTML).
 * @param {string} sectionId - The ID of the section to show.
 * @param {Event} event - The click event object.
 */
window.showSection = function(sectionId, event) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.add('d-none'));
    
    const targetSection = document.getElementById(sectionId);
    
    // Check for premium access before showing
    if (!userIsPremium && targetSection?.classList.contains('premium-section')) {
        showPayment();
        document.getElementById('overview')?.classList.remove('d-none'); // Fallback to overview
        
        // Reset active nav link to Overview
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('onclick')?.includes('overview')) {
                link.classList.add('active');
            }
        });
        return;
    }
    
    // Show the section
    targetSection?.classList.remove('d-none');
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    // Use currentTarget for better event handling on the element with the listener
    event.currentTarget.classList.add('active');
};

/**
 * Global function for user logout (called from HTML).
 */
window.logout = async function() {
    try {
        if (timerInterval) clearInterval(timerInterval);
        if (pomodoroInterval) clearInterval(pomodoroInterval);
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        
        await signOut(auth);
        window.location.href = 'register.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

// =====================================================================
// 4. FLUTTERWAVE PAYMENT SYSTEM
// =====================================================================

/**
 * Creates and shows the payment modal.
 */
window.showPayment = function() {
    const modalElement = document.getElementById('paymentModal');
    
    if (modalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
    } else {
        // Create the modal HTML dynamically if it wasn't in the page already
        const modalHTML = `
        <div class="modal fade" id="paymentModal" tabindex="-1" aria-labelledby="paymentModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="paymentModalLabel">🎓 Upgrade to Premium</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <h4 class="text-primary">₦${PREMIUM_PRICE_NGN} / 30 Days</h4>
                            <p class="text-muted">Unlock all premium features instantly!</p>
                        </div>
                        
                        <div class="premium-features-list mb-4">
                            <h6>Premium Features:</h6>
                            <ul class="list-unstyled">
                                <li>✅ Advanced Study Tools (Pomodoro, Flashcards)</li>
                                <li>✅ Premium Calculators (e.g., Target CGPA)</li>
                                <li>✅ Commerce Tools (Promotions, Analytics)</li>
                                <li>✅ Unlimited Storage & Analytics</li>
                                <li>✅ Priority Support</li>
                            </ul>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary btn-lg" onclick="processPayment()">
                                💳 Upgrade Now - ₦${PREMIUM_PRICE_NGN}
                            </button>
                            <button class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                Maybe Later
                            </button>
                        </div>
                        
                        <div id="paymentStatus" class="mt-3 text-center"></div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        // Show the newly created modal
        const newModal = new bootstrap.Modal(document.getElementById('paymentModal'));
        newModal.show();
    }
};

/**
 * Initializes and starts the Flutterwave payment process.
 */
window.processPayment = function() {
    if (!currentUser) {
        alert('Authentication error. Please refresh the page.');
        return;
    }
    if (FLUTTERWAVE_PUBLIC_KEY.includes('xxxxxxxx')) {
        alert('CRITICAL ERROR: Please set your FLUTTERWAVE_PUBLIC_KEY at the top of dashboard.js.');
        return;
    }

    const paymentStatus = document.getElementById('paymentStatus');
    paymentStatus.innerHTML = '<div class="alert alert-info">Processing payment... Please wait for the payment window.</div>';

    const transactionId = "CB-" + Date.now() + "-" + currentUser.uid.substring(0, 8);
    
    FlutterwaveCheckout({
        public_key: FLUTTERWAVE_PUBLIC_KEY,
        tx_ref: transactionId,
        amount: PREMIUM_PRICE_NGN,
        currency: "NGN",
        country: "NG",
        payment_options: "card, banktransfer, ussd, mobilemoney",
        customer: {
            email: currentUser.email,
            phone_number: "08012345678", // Placeholder
            name: currentUser.displayName || currentUser.email.split('@')[0],
        },
        callback: async function (data) {
            console.log('Payment callback received:', data);
            
            // Close the Flutterwave popup
            if (data.status === "successful") {
                paymentStatus.innerHTML = '<div class="alert alert-success">Payment successful! Activating premium...</div>';
                // CRITICAL: Update the user's premium status
                await handleSuccessfulPayment(transactionId, data.transaction_id || data.flw_ref);
            } else {
                paymentStatus.innerHTML = '<div class="alert alert-warning">Payment failed or was canceled. Please try again.</div>';
            }
        },
        onclose: function() {
            // Only update if no success message is already showing
            if (paymentStatus.innerHTML.includes('Processing')) {
                paymentStatus.innerHTML = '<div class="alert alert-secondary">Payment window closed.</div>';
            }
        },
        customizations: {
            title: "Campus Boost Premium",
            description: `${TRIAL_DAYS}-Day Premium Subscription`,
            logo: "https://via.placeholder.com/100x100?text=CB",
        },
    });
};

/**
 * CRITICAL FUNCTION: Updates user's premium status in Firestore and locally after successful payment.
 */
async function handleSuccessfulPayment(transactionId, flutterwaveRef) {
    try {
        const premiumExpiry = new Date();
        premiumExpiry.setDate(premiumExpiry.getDate() + 30);
        
        // --- 1. Update User Document ---
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isPremium: true,
            premiumExpiry: premiumExpiry,
            isTrialUser: false, // End any active trial upon paid upgrade
            premiumActivatedAt: serverTimestamp(),
            lastPaymentDate: serverTimestamp()
        });

        // --- 2. Create Transaction Record ---
        await addDoc(collection(db, 'transactions'), {
            userId: currentUser.uid,
            transactionId: transactionId,
            flutterwaveRef: flutterwaveRef,
            amount: PREMIUM_PRICE_NGN,
            currency: "NGN",
            status: "completed",
            type: "premium_subscription",
            premiumExpiry: premiumExpiry,
            createdAt: serverTimestamp(),
            completedAt: serverTimestamp()
        });

        // --- 3. Update Local State and UI ---
        userIsPremium = true;
        
        const modalElement = document.getElementById('paymentModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            // Keep the modal open to show the success message briefly
            setTimeout(() => {
                modalInstance.hide();
                loadUserData(currentUser); // Refresh everything
                alert('🎉 Premium activated successfully! You now have access to all premium features for 30 days.');
            }, 1500); 
        }
        
    } catch (error) {
        console.error('CRITICAL ERROR in handleSuccessfulPayment:', error);
        document.getElementById('paymentStatus').innerHTML = '<div class="alert alert-danger">Error activating premium. Please contact support immediately with Transaction ID: ' + transactionId + '</div>';
    }
}

/**
 * Fallback mechanism to check for completed payments (e.g., if a user refreshes mid-process).
 */
async function checkPendingPayments() {
    if (!currentUser) return;
    
    const transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
    );
    
    // Use onSnapshot to listen for updates in real-time
    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const transaction = change.doc.data();
            // Check for new completed transaction that hasn't been processed
            if (change.type === 'added' || change.type === 'modified') {
                if (transaction.userId === currentUser.uid && 
                    transaction.status === "completed" && 
                    !userIsPremium) {
                    
                    console.log('Found completed transaction via fallback. Updating premium status...');
                    await loadUserData(currentUser); 
                    // Unsubscribe to avoid infinite loops if loadUserData triggers a state change
                    unsubscribe(); 
                }
            }
        });
    });
}

// =====================================================================
// 5. FEATURE IMPLEMENTATIONS (CGPA, PLANNER, TIMERS)
// =====================================================================

// --- CGPA Calculator Functions ---
window.addSubject = function() {
    const container = document.getElementById('subjectsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'subject-row row mb-3 align-items-center'; // Added align-items-center
    newRow.innerHTML = `
        <div class="col-md-4 mb-2 mb-md-0">
            <input type="text" class="form-control" placeholder="Subject Name">
        </div>
        <div class="col-md-3 mb-2 mb-md-0">
            <input type="number" class="form-control" placeholder="Credit Units" min="1" max="6">
        </div>
        <div class="col-md-3 mb-2 mb-md-0">
            <select class="form-control">
                <option value="0">Select Grade</option>
                <option value="5">A (5.0)</option>
                <option value="4">B (4.0)</option>
                <option value="3">C (3.0)</option>
                <option value="2">D (2.0)</option>
                <option value="1">E (1.0)</option>
                <option value="0">F (0.0)</option>
            </select>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-danger w-100" onclick="removeSubject(this)">Remove</button>
        </div>
    `;
    container.appendChild(newRow);
};

window.removeSubject = function(button) {
    button.closest('.subject-row').remove();
};

window.calculateCGPA = async function() {
    const rows = document.querySelectorAll('#subjectsContainer .subject-row');
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
    
    // Persist CGPA to Firestore
    if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            cgpa: cgpa,
            cgpaLastUpdated: serverTimestamp()
        });
    }
};

// --- Study Planner (To-Do List) Functions ---
document.getElementById('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;

    const taskName = document.getElementById('taskName').value;
    const taskSubject = document.getElementById('taskSubject').value;
    const taskDate = document.getElementById('taskDate').value;
    const taskPriority = document.getElementById('taskPriority').value;

    if (!taskName || !taskDate) {
        alert('Please fill in task name and due date.');
        return;
    }
    
    try {
        await addDoc(collection(db, 'tasks'), {
            userId: currentUser.uid,
            name: taskName,
            subject: taskSubject || 'General',
            dueDate: new Date(taskDate),
            priority: taskPriority,
            completed: false,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('taskForm').reset();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Could not add task. See console for details.');
    }
});

function loadTasks() {
    if (!currentUser) return;
    
    const tasksQuery = query(
        collection(db, 'tasks'),
        orderBy('completed', 'asc'), 
        orderBy('dueDate', 'asc')
    );
    
    // Real-time listener
    onSnapshot(tasksQuery, (snapshot) => {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        tasksList.innerHTML = '';
        
        snapshot.forEach((docSnapshot) => {
            const task = docSnapshot.data();
            if (task.userId === currentUser.uid) {
                const isCompleted = task.completed;
                const taskId = docSnapshot.id;
                const taskElement = document.createElement('div');
                taskElement.className = `task-item d-flex justify-content-between align-items-center py-2 border-bottom ${isCompleted ? 'text-decoration-line-through text-success' : ''}`;
                
                const priorityColors = { 'high': 'danger', 'medium': 'warning', 'low': 'success' };
                const taskDate = task.dueDate.toDate().toLocaleDateString();
                
                taskElement.innerHTML = `
                    <div>
                        <strong>${task.name}</strong>
                        <div class="text-muted small">${task.subject} - Due: ${taskDate}</div>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-${priorityColors[task.priority]} me-2">${task.priority.toUpperCase()}</span>
                        <button class="btn btn-sm ${isCompleted ? 'btn-outline-secondary' : 'btn-outline-success'}" onclick="completeTask('${taskId}', ${isCompleted})">
                            ${isCompleted ? 'Done' : '✓'}
                        </button>
                    </div>
                `;
                tasksList.appendChild(taskElement);
            }
        });
    });
}

window.completeTask = async function(taskId, isCompleted) {
    if (isCompleted) return; 
    try {
        await updateDoc(doc(db, 'tasks', taskId), {
            completed: true,
            completedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error completing task:', error);
    }
};

// --- Timer Functions (Simple Timer) ---
window.startTimer = function() {
    // ... [Timer logic is sound, no major change needed here] ...
    const minutesInput = document.getElementById('timerMinutes');
    const secondsInput = document.getElementById('timerSeconds');
    const timerDisplay = document.getElementById('timerDisplay');
    
    const initialMinutes = parseInt(minutesInput.value) || 0;
    const initialSeconds = parseInt(secondsInput.value) || 0;
    let totalSeconds = (initialMinutes * 60) + initialSeconds;
    
    if (totalSeconds <= 0) {
        alert('Please enter a valid time');
        return;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    
    const startTime = new Date().getTime();

    document.getElementById('timerStart').disabled = true;
    document.getElementById('timerStop').disabled = false;
    document.getElementById('timerReset').disabled = false;
    
    timerInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = '00:00';
            document.getElementById('timerStart').disabled = false;
            document.getElementById('timerStop').disabled = true;
            document.getElementById('timerReset').disabled = true;
            
            // Record the study time
            const endTime = new Date().getTime();
            const durationMinutes = Math.floor((endTime - startTime) / 60000);
            saveStudyHours(durationMinutes);
            alert('⏰ Timer finished! Study time logged.');
            return;
        }
        
        totalSeconds--;
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        timerDisplay.textContent = 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
};

window.stopTimer = function() {
    // ... [Stop logic is sound] ...
    clearInterval(timerInterval);
    document.getElementById('timerStart').disabled = false;
    document.getElementById('timerStop').disabled = true;
};

window.resetTimer = function() {
    // ... [Reset logic is sound] ...
    clearInterval(timerInterval);
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('timerStart').disabled = false;
    document.getElementById('timerStop').disabled = true;
    document.getElementById('timerReset').disabled = true;
    document.getElementById('timerMinutes').value = '';
    document.getElementById('timerSeconds').value = '';
};

/**
 * Saves study hours to Firestore.
 * @param {number} minutes - The number of minutes studied.
 */
async function saveStudyHours(minutes) {
    if (!currentUser || minutes <= 0) return;
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const currentHours = parseInt(userDoc.data()?.studyHours || 0);
        
        // Convert minutes to hours (1 minute is 1/60th of an hour)
        const newHours = (currentHours + (minutes / 60)).toFixed(1);

        await updateDoc(userDocRef, {
            studyHours: parseFloat(newHours),
            lastStudySession: serverTimestamp()
        });
        
        document.getElementById('studyHours').textContent = newHours;
    } catch (error) {
        console.error('Error logging study hours:', error);
    }
}

// --- Stopwatch Functions ---
window.startStopwatch = function() {
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    let totalSeconds = 0;
    const stopwatchDisplay = document.getElementById('stopwatchDisplay');
    const startTime = new Date().getTime(); // Record start time
    
    document.getElementById('stopwatchStart').disabled = true;
    document.getElementById('stopwatchStop').disabled = false;
    document.getElementById('stopwatchReset').disabled = false;
    
    stopwatchInterval = setInterval(() => {
        totalSeconds++;
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        stopwatchDisplay.textContent = 
            `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
    // Attach the start time to the display element for stopStopwatch to use
    stopwatchDisplay.dataset.startTime = startTime;
};

window.stopStopwatch = function() {
    clearInterval(stopwatchInterval);
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;

    // Log study time from stopwatch
    const stopwatchDisplay = document.getElementById('stopwatchDisplay');
    const startTime = parseInt(stopwatchDisplay.dataset.startTime);
    if (startTime) {
        const endTime = new Date().getTime();
        const durationMinutes = Math.floor((endTime - startTime) / 60000);
        saveStudyHours(durationMinutes);
        alert(`Stopwatch time logged: ${durationMinutes} minutes.`);
    }
};

window.resetStopwatch = function() {
    clearInterval(stopwatchInterval);
    document.getElementById('stopwatchDisplay').textContent = '00:00:00';
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;
    document.getElementById('stopwatchReset').disabled = true;
    document.getElementById('stopwatchDisplay').dataset.startTime = ''; // Clear stored time
};

// --- Placeholder Functions (For Premium Features) ---

window.startPomodoro = function() {
    if (!userIsPremium) { showPayment(); return; }
    if (pomodoroInterval) clearInterval(pomodoroInterval);
    alert('Pomodoro started! (Full logic implementation needed)');
    // **TODO: Implement Pomodoro Timer Logic**
};

window.stopPomodoro = function() {
    if (pomodoroInterval) clearInterval(pomodoroInterval);
    alert('Pomodoro stopped!');
};

window.saveNote = () => { if (!userIsPremium) { showPayment(); return; } console.log('Save Note logic goes here.'); };
window.exportNote = () => { if (!userIsPremium) { showPayment(); return; } console.log('Export Note logic goes here.'); };
window.convertUnit = () => { if (!userIsPremium) { showPayment(); return; } console.log('Convert Unit logic goes here.'); };
window.searchDictionary = () => { if (!userIsPremium) { showPayment(); return; } console.log('Search Dictionary logic goes here.'); };
window.addFlashcard = () => { if (!userIsPremium) { showPayment(); return; } console.log('Add Flashcard logic goes here.'); };
window.showAddProduct = () => { if (!userIsPremium) { showPayment(); return; } console.log('Show Add Product logic goes here.'); };
window.showPromoteProduct = () => { if (!userIsPremium) { showPayment(); return; } console.log('Show Promote Product logic goes here.'); };
