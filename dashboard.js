// --- Imports ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- Firebase Configuration ---
// NOTE: For production, consider using environment variables or a separate config file
// to manage your keys, especially the API Key.
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

// --- Global State ---
let currentUser = null;
let userIsPremium = false;
let timerInterval = null;
let pomodoroInterval = null;
let stopwatchInterval = null;

// --- Authentication and User Data Management ---

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // User is logged in, load data and check status
        await loadUserData(user);
        checkPremiumStatus();
        loadTasks(); // Load study planner tasks
    } else {
        // User is logged out, redirect to registration/login page
        window.location.href = 'register.html';
    }
});

/**
 * Loads user data, updates UI, and determines premium status.
 * @param {import('firebase/auth').User} user - The authenticated Firebase user object.
 */
async function loadUserData(user) {
    if (!user) return;
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        // Ensure initial user document is created if it somehow doesn't exist
        if (!userDoc.exists()) {
            console.warn("User document not found. Redirecting to ensure profile creation.");
            // In a real application, you might redirect to a profile setup page
            // or use setDoc to create the profile here.
            return; 
        }

        const userData = userDoc.data();
        
        // Update basic UI elements
        const fullName = userData.fullName || 'Student';
        document.getElementById('userName').textContent = fullName;
        document.getElementById('dashboardUserName').textContent = fullName;
        
        // --- Premium Status Logic ---
        const premiumExpiry = userData.premiumExpiry?.toDate();
        const now = new Date();
        const isPaidPremium = premiumExpiry && premiumExpiry > now;
        
        // Calculate trial period (30 days from creation)
        const accountCreated = userData.createdAt?.toDate() || userData.registeredAt?.toDate();
        const trialEnd = accountCreated ? new Date(accountCreated.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;
        const isTrialActive = trialEnd && now < trialEnd;
        
        // Set global premium status
        userIsPremium = isPaidPremium || (userData.isTrialUser && isTrialActive);
        
        // --- UI Updates based on Premium Status ---
        document.getElementById('currentCGPA').textContent = userData.cgpa || '0.00';
        document.getElementById('studyHours').textContent = userData.studyHours || '0';
        document.getElementById('itemsSold').textContent = userData.itemsSold || '0';
        document.getElementById('totalEarnings').textContent = `₦${userData.totalEarnings?.toLocaleString() || '0'}`;

        const premiumBadge = document.getElementById('premiumBadge');
        const premiumAlert = document.getElementById('premiumAlert');

        if (userIsPremium) {
            premiumBadge?.classList.remove('d-none');
            premiumAlert?.classList.add('d-none');
            
            if (userData.isTrialUser && !isPaidPremium && isTrialActive && trialEnd) {
                // Show trial alert for active trial users
                const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                premiumAlert?.classList.remove('d-none');
                document.getElementById('trialDays').textContent = daysLeft + ' days';
            }
        } else {
            // Non-premium users
            premiumBadge?.classList.add('d-none');
            premiumAlert?.classList.add('d-none');
        }
        
        // Apply lock/unlock UI to features
        updatePremiumFeatures();
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

/**
 * Applies visual locks and payment prompts to premium features.
 */
function checkPremiumStatus() {
    const premiumFeatures = document.querySelectorAll('.premium-feature');
    
    premiumFeatures.forEach(element => {
        // Remove any existing lock icons first
        const existingLockIcon = element.querySelector('.lock-icon');
        if (existingLockIcon) existingLockIcon.remove();
        
        if (!userIsPremium) {
            // Clone and replace element to remove existing event listeners safely
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            
            // Add click listener to show payment modal
            newElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showPayment();
            }, { once: true }); // Only add the listener once per status check
            
            // Add lock icon
            const lockSpan = document.createElement('span');
            lockSpan.className = 'lock-icon ms-2';
            lockSpan.innerHTML = '🔒';
            newElement.appendChild(lockSpan);
            
            // Apply dimmed style
            newElement.classList.add('text-muted');
            newElement.style.opacity = '0.6';
            newElement.style.cursor = 'pointer';
        } else {
            // Unlock styles for premium users
            element.classList.remove('text-muted');
            element.style.opacity = '1';
            element.style.cursor = 'default';
            // Important: ensure no payment listener remains if it was a clone
            element.removeEventListener('click', showPayment);
        }
    });
}

/**
 * Updates UI of all elements marked as premium.
 */
function updatePremiumFeatures() {
    const premiumElements = document.querySelectorAll('.premium-feature, .premium-section');
    
    premiumElements.forEach(element => {
        if (!userIsPremium) {
            element.classList.add('text-muted');
            element.style.opacity = '0.6';
        } else {
            element.classList.remove('text-muted');
            element.style.opacity = '1';
        }
    });
}

// --- Navigation ---
window.showSection = function(sectionId, event) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.add('d-none'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    targetSection?.classList.remove('d-none');
    
    // Update nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    event.target.classList.add('active'); // Set the clicked link as active
    
    // Block access to premium sections if user is not premium
    if (!userIsPremium && targetSection?.classList.contains('premium-section')) {
        showPayment();
        // Show overview instead
        document.getElementById('overview')?.classList.remove('d-none');
        targetSection.classList.add('d-none');
        
        // Reset active nav link to Overview
        navLinks.forEach(link => {
            if (link.getAttribute('onclick')?.includes('overview')) {
                link.classList.add('active');
            }
        });
    }
};

// --- Payment System (Flutterwave) ---

/**
 * Creates and shows the payment modal.
 */
window.showPayment = function() {
    // Check if the modal already exists to avoid duplication
    if (!document.getElementById('paymentModal')) {
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
                            <h4 class="text-primary">₦500 / 30 Days</h4>
                            <p class="text-muted">Unlock all premium features instantly!</p>
                        </div>
                        
                        <div class="premium-features-list mb-4">
                            <h6>Premium Features:</h6>
                            <ul class="list-unstyled">
                                <li>✅ Advanced Study Tools</li>
                                <li>✅ Premium Calculators (e.g., Target CGPA)</li>
                                <li>✅ Unlimited Flashcards</li>
                                <li>✅ Advanced Analytics & Insights</li>
                                <li>✅ Priority Support</li>
                            </ul>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary btn-lg" onclick="processPayment()">
                                💳 Upgrade Now - ₦500
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
    }
    
    const modalElement = document.getElementById('paymentModal');
    // Ensure Bootstrap is loaded before attempting to show the modal
    if (typeof bootstrap !== 'undefined' && modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error("Bootstrap Modal or Modal Element not found.");
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

    const paymentStatus = document.getElementById('paymentStatus');
    paymentStatus.innerHTML = '<div class="alert alert-info">Processing payment... Please wait for the payment window.</div>';

    // Generate unique transaction reference
    const transactionId = "CB-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    
    // NOTE: Replace 'FLWPUBK-b144c0c07294bbc6f4b3ac884960f766-X' with your actual Flutterwave Public Key
    // The key in the prompt is a placeholder/test key.
    
    FlutterwaveCheckout({
        public_key: "FLWPUBK-b144c0c07294bbc6f4b3ac884960f766-X",
        tx_ref: transactionId,
        amount: 500,
        currency: "NGN",
        country: "NG",
        payment_options: "card, banktransfer, ussd, mobilemoney",
        customer: {
            email: currentUser.email,
            phone_number: "08012345678", // Consider fetching/using a user-provided phone number
            name: currentUser.displayName || currentUser.email.split('@')[0],
        },
        callback: async function (data) {
            console.log('Payment callback received:', data);
            
            if (data.status === "successful") {
                paymentStatus.innerHTML = '<div class="alert alert-success">Payment successful! Activating premium...</div>';
                // CRITICAL: Call the function that updates the user's premium status
                await handleSuccessfulPayment(transactionId, data.transaction_id || data.flw_ref);
            } else {
                paymentStatus.innerHTML = '<div class="alert alert-warning">Payment was not completed. Please try again.</div>';
            }
        },
        onclose: function() {
            console.log("Payment modal closed");
            // Only update if no success message is already showing
            if (paymentStatus.innerHTML.includes('Processing')) {
                paymentStatus.innerHTML = '<div class="alert alert-secondary">Payment window closed.</div>';
            }
        },
        customizations: {
            title: "Campus Boost Premium",
            description: "30-Day Premium Subscription",
            logo: "https://via.placeholder.com/100x100?text=CB",
        },
    });
};

/**
 * CRITICAL FUNCTION: Updates user's premium status in Firestore and locally after successful payment.
 * @param {string} transactionId - The internal transaction reference.
 * @param {string} flutterwaveRef - The transaction reference from Flutterwave.
 */
async function handleSuccessfulPayment(transactionId, flutterwaveRef) {
    try {
        console.log('Handling successful payment and granting premium access...');
        
        // Calculate premium expiry (30 days from now)
        const premiumExpiry = new Date();
        premiumExpiry.setDate(premiumExpiry.getDate() + 30);
        
        // --- 1. Update User Document ---
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isPremium: true,
            premiumExpiry: premiumExpiry,
            isTrialUser: false, // End any active trial
            premiumActivatedAt: new Date(),
            lastPaymentDate: new Date()
        });

        // --- 2. Create Transaction Record ---
        await addDoc(collection(db, 'transactions'), {
            userId: currentUser.uid,
            transactionId: transactionId,
            flutterwaveRef: flutterwaveRef,
            amount: 500,
            currency: "NGN",
            status: "completed",
            type: "premium_subscription",
            premiumExpiry: premiumExpiry,
            createdAt: new Date(),
            completedAt: new Date()
        });

        console.log('Premium status updated successfully in Firestore.');

        // --- 3. Update Local State and UI ---
        userIsPremium = true;

        const paymentStatus = document.getElementById('paymentStatus');
        paymentStatus.innerHTML = '<div class="alert alert-success">🎉 Premium activated successfully! Unlocking features...</div>';

        // Close modal and refresh after delay to ensure all UI is updated
        setTimeout(async () => {
            // Hide the modal
            const modalElement = document.getElementById('paymentModal');
            if (modalElement && typeof bootstrap !== 'undefined') {
                 // Check if an instance exists, then hide
                const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modalInstance.hide();
            }
            
            // Reload user data and re-check features
            await loadUserData(currentUser);
            checkPremiumStatus();
            
            alert('🎉 Premium activated successfully! You now have access to all premium features for 30 days.');
            
        }, 1500); // 1.5 seconds delay
        
    } catch (error) {
        console.error('CRITICAL ERROR in handleSuccessfulPayment:', error);
        const paymentStatus = document.getElementById('paymentStatus');
        paymentStatus.innerHTML = '<div class="alert alert-danger">Error activating premium. Please contact support immediately with Transaction ID: ' + transactionId + '</div>';
    }
}

/**
 * Fallback mechanism to check for completed payments (e.g., if a user refreshes mid-process).
 */
async function checkPendingPayments() {
    if (!currentUser) return;
    
    // Query for transactions related to the current user
    const transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
    );
    
    // Use onSnapshot to listen for updates in real-time
    onSnapshot(transactionsQuery, (snapshot) => {
        snapshot.forEach(async (docSnapshot) => {
            const transaction = docSnapshot.data();
            // If we find a completed transaction for this user AND the local state says they aren't premium
            if (transaction.userId === currentUser.uid && 
                transaction.status === "completed" && 
                !userIsPremium) {
                
                // This means the user must have refreshed or an error occurred before state updated
                console.log('Found completed transaction via fallback. Updating premium status...');
                // The loadUserData function will correctly calculate the expiry and update userIsPremium
                await loadUserData(currentUser); 
                checkPremiumStatus();
            }
        });
    });
}

// --- CGPA Calculator Functions (Retained from original code) ---
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
    
    // OPTIONAL: Persist CGPA to Firestore here
};

// --- Study Planner Functions (Retained and completed with placeholder) ---
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
            createdAt: new Date()
        });
        
        document.getElementById('taskForm').reset();
        // loadTasks is called by onSnapshot listener automatically
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Could not add task. See console for details.');
    }
});

async function loadTasks() {
    if (!currentUser) return;
    
    const tasksQuery = query(
        collection(db, 'tasks'),
        orderBy('completed', 'asc'), // Show incomplete tasks first
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
                const taskElement = document.createElement('div');
                taskElement.className = `task-item d-flex justify-content-between align-items-center py-2 border-bottom ${isCompleted ? 'text-decoration-line-through text-success' : ''}`;
                
                const priorityColors = {
                    'high': 'danger',
                    'medium': 'warning',
                    'low': 'success'
                };
                
                const taskDate = task.dueDate.toDate().toLocaleDateString();
                
                taskElement.innerHTML = `
                    <div>
                        <strong>${task.name}</strong>
                        <div class="text-muted small">${task.subject} - Due: ${taskDate}</div>
                    </div>
                    <div>
                        <span class="badge bg-${priorityColors[task.priority]}">${task.priority.toUpperCase()}</span>
                        <button class="btn btn-sm ${isCompleted ? 'btn-outline-secondary' : 'btn-outline-success'} ms-2" onclick="completeTask('${docSnapshot.id}', ${isCompleted})" ${isCompleted ? 'disabled' : ''}>
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
    if (isCompleted) return; // Prevent re-completing
    try {
        await updateDoc(doc(db, 'tasks', taskId), {
            completed: true,
            completedAt: new Date()
        });
    } catch (error) {
        console.error('Error completing task:', error);
    }
};

// --- Timer Functions (Retained from original code) ---
window.startTimer = function() {
    const minutesInput = document.getElementById('timerMinutes');
    const secondsInput = document.getElementById('timerSeconds');
    const timerDisplay = document.getElementById('timerDisplay');
    
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;
    let totalSeconds = (minutes * 60) + seconds;
    
    if (totalSeconds <= 0) {
        alert('Please enter a valid time');
        return;
    }
    
    // Stop any existing timer
    if (timerInterval) clearInterval(timerInterval);
    
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
            // Also update study hours in Firestore
            // saveStudyHours(minutes); 
            alert('⏰ Timer finished!');
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


// --- Placeholder Functions for Completeness ---
// In a production environment, you would implement the full logic for these.

window.startPomodoro = function() {
    if (!userIsPremium) { showPayment(); return; }
    alert('Pomodoro started! (Full implementation required)');
    // Implement Pomodoro logic (e.g., 25 min work, 5 min break)
};

window.stopPomodoro = function() {
    alert('Pomodoro stopped! (Full implementation required)');
};

window.startStopwatch = function() {
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    let totalSeconds = 0;
    const stopwatchDisplay = document.getElementById('stopwatchDisplay');
    
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
};

window.stopStopwatch = function() {
    clearInterval(stopwatchInterval);
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;
    // Log study time here
};

window.resetStopwatch = function() {
    clearInterval(stopwatchInterval);
    document.getElementById('stopwatchDisplay').textContent = '00:00:00';
    document.getElementById('stopwatchStart').disabled = false;
    document.getElementById('stopwatchStop').disabled = true;
    document.getElementById('stopwatchReset').disabled = true;
};
// --- End Placeholder Functions ---


// --- Dashboard Initialization and Utilities ---
document.addEventListener('DOMContentLoaded', () => {
    // NOTE: loadTasks is called inside onAuthStateChanged
    checkPendingPayments(); // Start checking for successful payments
    
    // Periodically check premium status to handle expiry
    setInterval(async () => {
        if (currentUser) {
            await loadUserData(currentUser);
            checkPremiumStatus();
        }
    }, 60000); // Check every 60 seconds (1 minute) for expiry updates
});

window.logout = async function() {
    try {
        // Clear all local intervals before signing out
        if (timerInterval) clearInterval(timerInterval);
        if (pomodoroInterval) clearInterval(pomodoroInterval);
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        
        await signOut(auth);
        window.location.href = 'index.html'; // Redirect to login/landing page
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error signing out. Please try again.');
    }
};

