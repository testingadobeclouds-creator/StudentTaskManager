/**
 * Firebase Configuration
 * Live Google Firebase credentials provided for student-task-manager
 */
export const firebaseConfig = {
    apiKey: "AIzaSyCdrDDa_8UMwlhyGWqOCAKga70lnT0B9k8",
    authDomain: "student-task-manager-e84a1.firebaseapp.com",
    databaseURL: "https://student-task-manager-e84a1-default-rtdb.firebaseio.com",
    projectId: "student-task-manager-e84a1",
    storageBucket: "student-task-manager-e84a1.firebasestorage.app",
    messagingSenderId: "131253221181",
    appId: "1:131253221181:web:87fb262037b28b76bcf754",
    measurementId: "G-V0KL7JRMYH"
};

/**
 * Check if the user has replaced placeholder credentials with real Firebase keys
 */
export function isFirebaseConfigured() {
    return firebaseConfig.apiKey && 
           firebaseConfig.apiKey !== "YOUR_API_KEY" && 
           !firebaseConfig.apiKey.includes("YOUR_");
}
