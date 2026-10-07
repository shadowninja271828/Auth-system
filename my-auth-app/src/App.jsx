import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isEmailRateLimited, setIsEmailRateLimited] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteMessage, setNoteMessage] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isCurrent = true;

    async function loadNote() {
      setIsNoteLoading(true);
      setNoteError("");
      setNoteMessage("");
      setNote("");

      const { data, error: loadError } = await supabase
        .from("user_notes")
        .select("content")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isCurrent) {
        return;
      }

      if (loadError) {
        setNoteError(loadError.message);
      } else {
        setNote(data?.content ?? "");
      }

      setIsNoteLoading(false);
    }

    loadNote();

    return () => {
      isCurrent = false;
    };
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsEmailRateLimited(false);
    setMessage("");
    setIsLoading(true);

    try {
      const { data, error: authError } = isSignUp
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

      if (authError) {
        throw authError;
      }

      if (data.session?.user) {
        setUser(data.session.user);
      } else if (isSignUp && data.user) {
        setPassword("");
        setMessage(
          "If this email can be registered, confirmation instructions will be sent. Check your inbox before logging in.",
        );
      }
    } catch (authError) {
      const errorMessage =
        authError.message || "Authentication failed. Please try again.";
      const isRateLimited = /email rate limit exceeded/i.test(errorMessage);

      setIsEmailRateLimited(isRateLimited);
      setError(
        isRateLimited
          ? "Supabase has temporarily limited confirmation emails for this project."
          : errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    setMessage("");

    try {
      const { error: authError } = await supabase.auth.signOut();

      if (authError) {
        throw authError;
      }

      setUser(null);
    } catch (authError) {
      setError(authError.message || "Unable to log out. Please try again.");
    }
  }

  async function handleSaveNote(event) {
    event.preventDefault();
    setNoteError("");
    setNoteMessage("");
    setIsNoteSaving(true);

    try {
      const { error: saveError } = await supabase.from("user_notes").upsert(
        { user_id: user.id, content: note },
        { onConflict: "user_id" },
      );

      if (saveError) {
        throw saveError;
      }

      setNoteMessage("Note saved.");
    } catch (saveError) {
      setNoteError(saveError.message || "Unable to save your note.");
    } finally {
      setIsNoteSaving(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="app-shell">
        <p className="session-check" role="status">
          Checking your session...
        </p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="app-shell">
        <section className="auth-card signed-in">
          <p className="greeting">Hello {user.email}</p>
          <form className="note-form" onSubmit={handleSaveNote}>
            <label htmlFor="user-note">Your personal note</label>
            <textarea
              id="user-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteMessage("");
              }}
              placeholder="Write something you want to keep..."
              rows={8}
              disabled={isNoteLoading || isNoteSaving}
            />
            {isNoteLoading && (
              <p className="feedback" role="status">
                Loading your note...
              </p>
            )}
            {noteError && (
              <p className="feedback error" role="alert">
                {noteError}
              </p>
            )}
            {noteMessage && (
              <p className="feedback success" role="status">
                {noteMessage}
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={isNoteLoading || isNoteSaving}
            >
              {isNoteSaving ? "Saving..." : "Save"}
            </button>
          </form>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
          {error && (
            <div className="feedback error" role="alert">
              <p>{error}</p>
              {isEmailRateLimited && (
                <p>
                  Wait for the limit to reset and avoid repeating sign-up
                  attempts. Supabase&apos;s default email service is heavily
                  rate-limited; configure a custom SMTP provider in your
                  project&apos;s Auth settings for regular use. See the{" "}
                  <a
                    href="https://supabase.com/docs/guides/auth/auth-smtp"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supabase SMTP setup guide
                  </a>
                  . Check <strong>Authentication → Users</strong> before trying
                  again in case the account was already created.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          A
        </div>
        <p className="eyebrow">YOUR SPACE, SECURED</p>
        <h1 id="auth-title">{isSignUp ? "Create your account" : "Welcome back"}</h1>
        <p className="subtitle">
          {isSignUp
            ? "Sign up with your email to get started."
            : "Log in to continue to your account."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder="At least 6 characters"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="feedback success" role="status">
              {message}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="mode-switch">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp((currentMode) => !currentMode);
              setError("");
              setIsEmailRateLimited(false);
              setMessage("");
            }}
          >
            {isSignUp ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default App;
