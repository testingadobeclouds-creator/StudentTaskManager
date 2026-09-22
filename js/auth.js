import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const AUTH_USER_KEY = 'student-task-manager-auth-user';

let firebaseApp = null;
let firebaseAuth = null;
let googleProvider = null;
let authStateListeners = [];
let currentUser = null;

async function initFirebase() {
    if (!isFirebaseConfigured()) {
        // Load existing local guest session if available
        const localUser = localStorage.getItem(AUTH_USER_KEY);
        if (localUser) {
            try {
                currentUser = JSON.parse(localUser);
            } catch (e) {
                currentUser = null;
            }
        }
        notifyAuthStateChanged(currentUser);
        return false;
    }

    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getAuth, GoogleAuthProvider, onAuthStateChanged, getRedirectResult } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        
        firebaseApp = initializeApp(firebaseConfig);
        firebaseAuth = getAuth(firebaseApp);
        googleProvider = new GoogleAuthProvider();
        googleProvider.addScope('email');
        googleProvider.addScope('profile');

        // Handle result from signInWithRedirect (called after page reload)
        try {
            const redirectResult = await getRedirectResult(firebaseAuth);
            if (redirectResult && redirectResult.user) {
                const user = redirectResult.user;
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL || null,
                    isGuest: false
                };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
            }
        } catch (redirectErr) {
            console.warn('Redirect result error:', redirectErr.message);
        }

        onAuthStateChanged(firebaseAuth, (user) => {
            if (user) {
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL || null,
                    isGuest: false
                };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
            } else {
                currentUser = null;
                localStorage.removeItem(AUTH_USER_KEY);
            }
            notifyAuthStateChanged(currentUser);
        });

        return true;
    } catch (err) {
        console.warn('Firebase SDK initialization notice:', err.message);
        return false;
    }
}

function notifyAuthStateChanged(user) {
    authStateListeners.forEach(fn => {
        try { fn(user); } catch (e) { console.error('Auth state listener error:', e); }
    });
}

async function loginWithEmail(email, password) {
    if (isFirebaseConfigured() && firebaseAuth) {
        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
            const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
            const user = userCredential.user;
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                isGuest: false
            };
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
            notifyAuthStateChanged(currentUser);
            return { success: true, user: currentUser };
        } catch (error) {
            console.warn('Firebase login notice:', error.code, error.message);
            if (error.code === 'auth/operation-not-allowed') {
                currentUser = {
                    uid: 'local-' + Date.now().toString(36),
                    email: email,
                    displayName: email.split('@')[0],
                    photoURL: null,
                    isGuest: false
                };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
                notifyAuthStateChanged(currentUser);
                return { success: true, user: currentUser, note: 'Signed in locally. Enable Email/Password in Firebase Console for cloud sync.' };
            }
            return { success: false, message: formatFirebaseError(error.code || error.message) };
        }
    }

    // Demo / Offline mode login when Firebase credentials are not yet entered
    currentUser = {
        uid: 'demo-' + Date.now().toString(36),
        email: email,
        displayName: email.split('@')[0],
        photoURL: null,
        isGuest: true
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    notifyAuthStateChanged(currentUser);
    return { 
        success: true, 
        user: currentUser, 
        note: 'Running in demo mode. Add your Firebase credentials in js/firebase-config.js to enable live cloud authentication.' 
    };
}

async function signupWithEmail(email, password, displayName) {
    if (isFirebaseConfigured() && firebaseAuth) {
        try {
            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            const user = userCredential.user;
            if (displayName) {
                await updateProfile(user, { displayName });
            }
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                isGuest: false
            };
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
            notifyAuthStateChanged(currentUser);
            return { success: true, user: currentUser };
        } catch (error) {
            console.warn('Firebase signup notice:', error.code, error.message);
            if (error.code === 'auth/operation-not-allowed') {
                currentUser = {
                    uid: 'local-' + Date.now().toString(36),
                    email: email,
                    displayName: displayName || email.split('@')[0],
                    photoURL: null,
                    isGuest: false
                };
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
                notifyAuthStateChanged(currentUser);
                return { 
                    success: true, 
                    user: currentUser, 
                    note: 'Account created locally. Enable Email/Password in Firebase Console for cloud sync.' 
                };
            }
            return { success: false, message: formatFirebaseError(error.code || error.message) };
        }
    }

    // Demo / Offline mode registration
    currentUser = {
        uid: 'demo-' + Date.now().toString(36),
        email: email,
        displayName: displayName || email.split('@')[0],
        photoURL: null,
        isGuest: true
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    notifyAuthStateChanged(currentUser);
    return { 
        success: true, 
        user: currentUser, 
        note: 'Running in demo mode. Add your Firebase credentials in js/firebase-config.js to enable live cloud authentication.' 
    };
}

async function loginWithGoogle() {
    if (isFirebaseConfigured() && firebaseAuth) {
        try {
            const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
            const result = await signInWithPopup(firebaseAuth, googleProvider);
            const user = result.user;
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                isGuest: false
            };
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
            notifyAuthStateChanged(currentUser);
            return { success: true, user: currentUser };
        } catch (error) {
            console.warn('Firebase Google Auth error:', error.code, error.message);

            // Popup was blocked by the browser — fall back to redirect-based sign-in
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                try {
                    const { signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
                    await signInWithRedirect(firebaseAuth, googleProvider);
                    // Page will reload; result is handled in initFirebase via getRedirectResult
                    return { success: true, user: null, note: 'Redirecting to Google sign-in...' };
                } catch (redirectErr) {
                    console.warn('Redirect sign-in failed:', redirectErr.message);
                    return { success: false, message: formatFirebaseError(redirectErr.code || redirectErr.message) };
                }
            }

            // For other errors (operation-not-allowed, unauthorized-domain, etc.) return the error
            return { success: false, message: formatFirebaseError(error.code || error.message) };
        }
    }

    // Firebase not configured — guest/demo fallback
    currentUser = {
        uid: 'google-demo-' + Date.now().toString(36),
        email: 'student@gmail.com',
        displayName: 'Google Student',
        photoURL: null,
        isGuest: true
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    notifyAuthStateChanged(currentUser);
    return { 
        success: true, 
        user: currentUser, 
        note: 'Running in demo mode. Configure Firebase in js/firebase-config.js to enable live Google sign-in.' 
    };
}

function loginAsGuest() {
    currentUser = {
        uid: 'guest-' + Date.now().toString(36),
        email: 'guest@student.local',
        displayName: 'Guest Student',
        photoURL: null,
        isGuest: true
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    notifyAuthStateChanged(currentUser);
    return { success: true, user: currentUser };
}

async function logout() {
    if (isFirebaseConfigured() && firebaseAuth) {
        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
            await signOut(firebaseAuth);
        } catch (e) {
            console.error('Firebase signout error:', e);
        }
    }
    currentUser = null;
    localStorage.removeItem(AUTH_USER_KEY);
    notifyAuthStateChanged(null);
    return { success: true };
}

function getCurrentUser() {
    if (currentUser) return currentUser;
    const local = localStorage.getItem(AUTH_USER_KEY);
    if (local) {
        try {
            currentUser = JSON.parse(local);
            return currentUser;
        } catch (e) {
            return null;
        }
    }
    return null;
}

function onAuthStateChangedListener(callback) {
    authStateListeners.push(callback);
    callback(getCurrentUser());
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

function formatFirebaseError(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters long.';
        case 'auth/popup-closed-by-user':
            return 'Sign in popup was closed before completing.';
        case 'auth/popup-blocked':
            return 'Popup was blocked. Trying redirect sign-in instead...';
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled. Please enable it in the Firebase Console.';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized for Firebase authentication. Add it in the Firebase Console → Authentication → Settings → Authorized domains.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using a different sign-in method.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return code || 'Authentication failed. Please try again.';
    }
}

export const Auth = {
    init: initFirebase,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    loginAsGuest,
    logout,
    getCurrentUser,
    onAuthStateChanged: onAuthStateChangedListener,
    isFirebaseConfigured
};
