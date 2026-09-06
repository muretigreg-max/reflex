import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";

// Use the live Render URL in production, or fallback to localhost for local testing
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

/* =========================================================
   STATUS CONFIGURATION
========================================================= */

const STATUS_META = {
  OPEN: {
    label: "Open",
    icon: "○",
    color: "#2563eb",
    background: "#eff6ff",
    border: "#bfdbfe",
  },
  ASSIGNED: {
    label: "Assigned",
    icon: "↗",
    color: "#b45309",
    background: "#fffbeb",
    border: "#fde68a",
  },
  PICKED_UP: {
    label: "Picked Up",
    icon: "📦",
    color: "#7c3aed",
    background: "#f5f3ff",
    border: "#ddd6fe",
  },
  DELIVERED: {
    label: "Delivered",
    icon: "✓",
    color: "#15803d",
    background: "#f0fdf4",
    border: "#bbf7d0",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: "×",
    color: "#b91c1c",
    background: "#fef2f2",
    border: "#fecaca",
  },
};

const ROLE_META = {
  RETAILER: {
    label: "Retailer",
    icon: "🏪",
    description: "Create and track delivery requests",
  },

  DISPATCHER: {
    label: "Dispatcher",
    icon: "📋",
    description: "Coordinate deliveries and riders",
  },

  RIDER: {
    label: "Rider",
    icon: "🛵",
    description: "Manage assigned deliveries",
  },

  ADMIN: {
    label: "Admin",
    icon: "🛡️",
    description: "Manage operations and dispatch",
  },
};

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

function AppHeader({ user, onLogout }) {
  const role = ROLE_META[user.role] || ROLE_META.RETAILER;
  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header style={styles.header}>
      <div style={styles.headerBrand}>
        <div style={styles.brandMark}>R</div>
        <div>
          <div style={styles.logo}>REFLEX</div>
          <div style={styles.subtitle}>Delivery coordination platform</div>
        </div>
      </div>

      <div style={styles.userArea}>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>{userInitial}</div>
          <div>
            <div style={styles.userName}>{user.name}</div>
            <div style={styles.roleBadge}>
              <span>{role.icon}</span>
              {role.label}
            </div>
          </div>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

function DashboardShell({ children }) {
  return <main style={styles.mainContainer}>{children}</main>;
}
function AdminDashboard({ user }) {
  const [users, setUsers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [newUser, setNewUser] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "DISPATCHER",
  });

  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  async function loadAdminData() {
    try {
      const [usersResponse, deliveriesResponse] = await Promise.all([
        fetch(`${API_URL}/users`),
        fetch(`${API_URL}/deliveries`),
      ]);

      if (!usersResponse.ok || !deliveriesResponse.ok) {
        throw new Error("Failed to load admin data");
      }

      const usersData = await usersResponse.json();
      const deliveriesData = await deliveriesResponse.json();

      setUsers(usersData);
      setDeliveries(deliveriesData);
      setRiders(usersData.filter((u) => u.role === "RIDER"));
    } catch (error) {
      console.error(error);
      setMessage("Failed to load data");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setUserMessage("");
    setUserError("");
    setCreatingUser(true);

    try {
      const response = await fetch(`${API_URL}/users/admin-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: user.id,
          name: newUser.name,
          phone: newUser.phone,
          email: newUser.email || null,
          password: newUser.password,
          role: newUser.role,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create user");

      setUserMessage("User created successfully.");
      setNewUser({ name: "", phone: "", email: "", password: "", role: "DISPATCHER" });
      setShowAddUser(false);
      await loadAdminData();
    } catch (error) {
      setUserError(error.message);
    } finally {
      setCreatingUser(false);
    }
  }

  async function assignRider(deliveryId) {
    const riderId = selectedRiders[deliveryId];
    if (!riderId) {
      setMessage("Please select a rider before assigning.");
      setMessageType("error");
      return;
    }

    setAssigning(deliveryId);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/deliveries/${deliveryId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: Number(riderId), dispatcherId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to assign rider");

      setMessage(`Delivery ${data.trackingCode} assigned successfully.`);
      setMessageType("success");

      setSelectedRiders((previous) => {
        const updated = { ...previous };
        delete updated[deliveryId];
        return updated;
      });

      await loadAdminData();
    } catch (error) {
      console.error("Failed to assign rider:", error);
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setAssigning(null);
    }
  }

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  const openDeliveries = deliveries.filter((d) => d.status === "OPEN").length;

  return (
    <div>
      <div style={styles.hero}>
        <div>
          <div style={styles.heroEyebrow}>🛡️ ADMIN CONTROL CENTER</div>
          <h1 style={styles.heroTitle}>Welcome, {user.name}</h1>
          <p style={styles.heroDescription}>
            Manage users, assign riders, and oversee the entire Reflex platform.
          </p>
        </div>
        <div style={styles.heroVisual}>🛡️</div>
      </div>

      <AlertMessage type={messageType} message={message} />

      <div style={styles.statsGrid}>
        <StatCard icon="👥" label="Total Users" value={users.length} description="Registered accounts" tone="blue" />
        <StatCard icon="🛵" label="Riders" value={riders.length} description="Available delivery riders" tone="purple" />
        <StatCard icon="" label="Retailers" value={users.filter((u) => u.role === "RETAILER").length} description="Retail accounts" tone="amber" />
        <StatCard icon="📦" label="Open Deliveries" value={openDeliveries} description="Requiring assignment" tone="green" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px", marginBottom: "30px" }}>
        
        {/* USER MANAGEMENT PANEL */}
        <section style={styles.panel}>
          <SectionHeader
            icon="👥"
            title="User Management"
            description="Users registered in Reflex"
            right={
              <button style={styles.primaryButton} onClick={() => { setShowAddUser(!showAddUser); setUserMessage(""); setUserError(""); }}>
                {showAddUser ? "✕ Close" : "+ Add User"}
              </button>
            }
          />
          
          {userMessage && <div style={styles.successMessage}>✓ {userMessage}</div>}
          {userError && <div style={styles.errorMessage}>⚠ {userError}</div>}

          {showAddUser && (
            <form onSubmit={handleCreateUser} style={styles.addUserForm}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.formLabel}>Full Name</label>
                  <input style={styles.formInput} type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Enter full name" required />
                </div>
                <div>
                  <label style={styles.formLabel}>Phone Number</label>
                  <input style={styles.formInput} type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="07XXXXXXXX" required />
                </div>
                <div>
                  <label style={styles.formLabel}>Email</label>
                  <input style={styles.formInput} type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="name@example.com" />
                </div>
                <div>
                  <label style={styles.formLabel}>Password</label>
                  <input style={styles.formInput} type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password" required />
                </div>
                <div>
                  <label style={styles.formLabel}>Role</label>
                  <select style={styles.formInput} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="DISPATCHER">📋 Dispatcher</option>
                    <option value="RETAILER">🏪 Retailer</option>
                    <option value="RIDER"> Rider</option>
                    <option value="ADMIN">🛡️ Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={styles.primaryButton} disabled={creatingUser}>
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </form>
          )}

          {loading ? (
            <p style={styles.mutedText}>Loading users...</p>
          ) : users.length === 0 ? (
            <p style={styles.mutedText}>No users found.</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Name</th>
                    <th style={styles.tableHeader}>Phone</th>
                    <th style={styles.tableHeader}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((account) => {
                    const roleMeta = ROLE_META[account.role] || ROLE_META.RETAILER;
                    return (
                      <tr key={account.id}>
                        <td style={styles.tableCell}><strong>{account.name}</strong></td>
                        <td style={styles.tableCell}>{account.phone}</td>
                        <td style={styles.tableCell}>
                          <span style={{ ...styles.statusBadge, background: "#f3f4f6", color: "#374151", borderColor: "#e5e7eb" }}>
                            {roleMeta.icon} {roleMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* DELIVERY QUEUE PANEL (Using your exact DeliveryCard layout) */}
        <section>
          <SectionHeader icon="▤" title="Delivery Queue" description="Review requests and assign available riders." right={<SyncIndicator />} />
          
          {deliveries.length === 0 ? (
            <EmptyState icon="📋" title="No deliveries in the queue" text="New delivery requests will appear here." />
          ) : (
            <div style={styles.grid}>
              {deliveries.map((delivery) => (
                <DeliveryCard key={delivery.id} delivery={delivery}>
                  {delivery.status === "OPEN" && (
                    <div style={styles.assignBox}>
                      <div style={styles.assignBoxHeader}>
                        <div>
                          <strong>Assign Rider</strong>
                          <div style={styles.mutedText}>Select a rider for this request.</div>
                        </div>
                        <span style={styles.actionRequiredBadge}>ACTION REQUIRED</span>
                      </div>
                      <select 
                        value={selectedRiders[delivery.id] || ""} 
                        onChange={(e) => setSelectedRiders((prev) => ({ ...prev, [delivery.id]: e.target.value }))} 
                        style={styles.riderSelect}
                      >
                        <option value="">Select rider...</option>
                        {riders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.name} — {rider.phone}
                          </option>
                        ))}
                      </select>
                      <button 
                        style={styles.primaryButton} 
                        onClick={() => assignRider(delivery.id)} 
                        disabled={assigning === delivery.id}
                      >
                        {assigning === delivery.id ? "Assigning..." : "Assign Rider"}
                      </button>
                    </div>
                  )}

                  {delivery.status !== "OPEN" && delivery.rider && (
                    <div style={styles.riderDisplay}>
                      <div style={styles.avatar}>{delivery.rider.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={styles.mutedText}>Assigned to:</div>
                        <strong>{delivery.rider.name}</strong>
                      </div>
                      <span style={styles.assignedPill}>ASSIGNED</span>
                    </div>
                  )}
                </DeliveryCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function StatCard({ icon, label, value, description, tone = "default" }) {
  const tones = {
    default: { background: "#eff6ff", color: "#1d4ed8" },
    blue: { background: "#eff6ff", color: "#2563eb" },
    amber: { background: "#fffbeb", color: "#b45309" },
    purple: { background: "#f5f3ff", color: "#7c3aed" },
    green: { background: "#f0fdf4", color: "#15803d" },
  };
  const selected = tones[tone] || tones.default;

  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: selected.background, color: selected.color }}>
        {icon}
      </div>
      <div style={styles.statContent}>
        <span style={styles.statLabel}>{label}</span>
        <strong style={styles.statNumber}>{value}</strong>
        <span style={styles.statDescription}>{description}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.OPEN;
  return (
    <span style={{ ...styles.statusBadge, color: meta.color, background: meta.background, borderColor: meta.border }}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function SectionHeader({ icon, title, description, right }) {
  return (
    <div style={styles.sectionHeader}>
      <div style={styles.sectionHeaderLeft}>
        {icon && <div style={styles.sectionIcon}>{icon}</div>}
        <div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {description && <p style={styles.sectionDescription}>{description}</p>}
        </div>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

function DeliveryCard({ delivery, children }) {
  return (
    <div style={styles.deliveryCard}>
      <div style={styles.cardTop}>
        <div>
          <div style={styles.tracking}>{delivery.trackingCode}</div>
          <div style={styles.customer}>{delivery.customerName}</div>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      <StatusTimeline status={delivery.status} />

      <div style={styles.infoGrid}>
        <InfoItem icon="📞" label="Phone" value={delivery.customerPhone} />
        <InfoItem icon="📍" label="Address" value={delivery.deliveryAddress} />
        <InfoItem icon="📦" label="Item" value={delivery.itemDescription} />
        {delivery.rider && <InfoItem icon="🛵" label="Rider" value={delivery.rider.name} />}
        {delivery.retailer && <InfoItem icon="🏪" label="Retailer" value={delivery.retailer.name} />}
      </div>

      {children}

      <div style={styles.cardSection}>
        <div style={styles.cardSectionTitle}>
          <span>▣</span>
          Delivery QR
        </div>
        <div style={styles.qrSection}>
          <QRCodeSVG value={delivery.trackingCode} size={90} />
          <div style={delivery.qrConfirmedAt ? styles.confirmedBox : styles.pendingBox}>
            <span>{delivery.qrConfirmedAt ? "✓" : "○"}</span>
            {delivery.qrConfirmedAt ? "QR confirmed" : "Awaiting QR confirmation"}
          </div>
        </div>
      </div>

      <HistoryTimeline history={delivery.statusHistory} />

      <div style={styles.cardDates}>
        <small>Created: {new Date(delivery.createdAt).toLocaleString()}</small>
        <small>Updated: {new Date(delivery.updatedAt).toLocaleString()}</small>
      </div>
    </div>
  );
}

function StatusTimeline({ status }) {
  const statuses = ["OPEN", "ASSIGNED", "PICKED_UP", "DELIVERED"];
  const currentIndex = statuses.indexOf(status);

  return (
    <div style={styles.timeline}>
      {statuses.map((item, index) => {
        const complete = currentIndex >= index;
        const active = currentIndex === index;

        return (
          <div key={item} style={styles.timelineItem}>
            <div
              style={{
                ...styles.timelineDot,
                ...(complete ? styles.timelineDotComplete : {}),
                ...(active ? styles.timelineDotActive : {}),
              }}
            >
              {complete ? "✓" : ""}
            </div>

            {index < statuses.length - 1 && (
              <div
                style={{
                  ...styles.timelineLine,
                  ...(currentIndex > index ? styles.timelineLineComplete : {}),
                }}
              />
            )}

            <span
              style={{
                ...styles.timelineLabel,
                ...(active ? styles.timelineLabelActive : {}),
              }}
            >
              {STATUS_META[item]?.label || item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value, highlight = false }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={{ ...styles.detailValue, ...(highlight ? styles.detailHighlight : {}) }}>
        {value}
      </strong>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoIcon}>{icon}</div>
      <div style={styles.infoContent}>
        <span style={styles.infoLabel}>{label}</span>
        <strong style={styles.infoValue}>{value}</strong>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>{icon}</div>
      <h3 style={styles.emptyTitle}>{title}</h3>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function AlertMessage({ type, message }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div style={{ ...styles.message, ...(isError ? styles.messageError : styles.messageSuccess) }}>
      <span style={styles.messageIcon}>{isError ? "!" : "✓"}</span>
      <span>{message}</span>
    </div>
  );
}

function HistoryTimeline({ history }) {
  return (
    <div style={styles.history}>
      <div style={styles.historyHeader}>
        <span>Activity</span>
        <span style={styles.historyCount}>{history?.length || 0} updates</span>
      </div>

      {!history || history.length === 0 ? (
        <div style={styles.noHistory}>Delivery request created.</div>
      ) : (
        history.map((item, index) => (
          <div key={item.id || index} style={styles.historyRow}>
            <div style={styles.historyMarker}>
              <div style={styles.historyDot}></div>
              {index < history.length - 1 && <div style={styles.historyConnector}></div>}
            </div>
            <div style={styles.historyContent}>
              <strong>
                {item.oldStatus ? `${STATUS_META[item.oldStatus]?.label || item.oldStatus} → ` : ""}
                {STATUS_META[item.newStatus]?.label || item.newStatus}
              </strong>
              <span style={styles.historyTime}>{new Date(item.changedAt).toLocaleString()}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SyncIndicator() {
  return (
    <div style={styles.sync}>
      <span style={styles.syncDot}></span>
      Auto-sync every 5 seconds
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div style={styles.empty}>
      <div style={styles.loadingIcon}>◌</div>
      <strong>{text}</strong>
      <p style={styles.emptyText}>Please wait...</p>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("reflexUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  function handleLogin(loggedInUser) {
    localStorage.setItem("reflexUser", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  function handleLogout() {
    localStorage.removeItem("reflexUser");
    setUser(null);
  }

  if (!user) {
    return (
      <>
        <style>{globalStyles}</style>
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
          <style>{globalStyles}</style>
<div style={styles.page}>
  <AppHeader user={user} onLogout={handleLogout} />

<DashboardShell>
  {user.role === "RETAILER" && <RetailerDashboard user={user} />}

  {user.role === "DISPATCHER" && (
    <DispatcherDashboard user={user} />
  )}

  {user.role === "ADMIN" && (
    <AdminDashboard user={user} />
  )}

  {user.role === "RIDER" && <RiderDashboard user={user} />}
</DashboardShell>
</div>
    </>
  );
}

/* =========================================================
   LOGIN SCREEN
========================================================= */

function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "RETAILER",
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleRegister(e) {
    e.preventDefault();

    if (!registerForm.name || !registerForm.phone || !registerForm.password || !registerForm.role) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.name,
          phone: registerForm.phone,
          email: registerForm.email || null,
          password: registerForm.password,
          role: registerForm.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      alert("Account created successfully. You can now log in.");
      setRegisterForm({ name: "", phone: "", email: "", password: "", confirmPassword: "", role: "RETAILER" });
      setShowRegister(false);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      onLogin(data);
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginShell}>
        <div style={styles.loginBrandPanel}>
          <div style={styles.loginBrandTop}>
            <div style={styles.brandMarkLarge}>R</div>
            <div>
              <div style={styles.loginBrandName}>REFLEX</div>
              <div style={styles.loginBrandTag}>DELIVERY COORDINATION</div>
            </div>
          </div>

          <div style={styles.loginBrandContent}>
            <div style={styles.loginEyebrow}>SMARTER DELIVERY OPERATIONS</div>
            <h1 style={styles.loginHeroTitle}>
              Move every delivery
              <br />
              with confidence.
            </h1>
            <p style={styles.loginHeroText}>
              One simple platform for retailers, dispatchers and riders to coordinate deliveries from request to confirmation.
            </p>

            <div style={styles.loginFlow}>
              <div style={styles.loginFlowItem}>
                <div style={styles.loginFlowIcon}>🏪</div>
                <span>Request</span>
              </div>
              <div style={styles.loginFlowLine}></div>
              <div style={styles.loginFlowItem}>
                <div style={styles.loginFlowIcon}>📋</div>
                <span>Dispatch</span>
              </div>
              <div style={styles.loginFlowLine}></div>
              <div style={styles.loginFlowItem}>
                <div style={styles.loginFlowIcon}>🛵</div>
                <span>Deliver</span>
              </div>
              <div style={styles.loginFlowLine}></div>
              <div style={styles.loginFlowItem}>
                <div style={styles.loginFlowIcon}>✓</div>
                <span>Confirm</span>
              </div>
            </div>
          </div>

          <div style={styles.loginBrandFooter}>Built for simple, accountable delivery operations.</div>
        </div>

        <div style={styles.loginCard}>
          <div style={styles.mobileLoginBrand}>
            <div style={styles.brandMark}>R</div>
            <strong>REFLEX</strong>
          </div>

          <div style={styles.loginHeader}>
            <div style={styles.loginWelcomeIcon}>👋</div>
            <div>
              <h2 style={styles.loginTitle}>{showRegister ? "Create Account" : "Welcome back"}</h2>
              <p style={styles.loginDescription}>
                {showRegister ? "Join as a Retailer or Rider" : "Sign in to access your workspace."}
              </p>
            </div>
          </div>

          <AlertMessage type="error" message={errorMessage} />

          <form onSubmit={showRegister ? handleRegister : login} style={styles.authForm}>
            {showRegister && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email (Optional)</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Role</label>
                  <select
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                    style={styles.input}
                    required
                  >
                    <option value="RETAILER">Retailer</option>
                    <option value="RIDER">Rider</option>
                  </select>
                </div>
              </>
            )}

            {!showRegister && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0700000001"
                  style={styles.input}
                  required
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={showRegister ? registerForm.password : password}
                onChange={(e) =>
                  showRegister
                    ? setRegisterForm({ ...registerForm, password: e.target.value })
                    : setPassword(e.target.value)
                }
                style={styles.input}
                required
              />
            </div>

            {showRegister && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
            )}

            <button type="submit" style={styles.loginButton} disabled={loading}>
              {loading ? (
                <>
                  <span style={styles.spinner}>◌</span>
                  Processing...
                </>
              ) : (
                <>
                  {showRegister ? "Register" : "Sign In"}
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div style={styles.featuresBox}>
  <div style={styles.featuresHeader}>
    <div style={styles.featuresIcon}>✨</div>
    <div>
      <strong>Why Choose Reflex?</strong>
      <div style={styles.featuresSubtitle}>Built for Kenyan retailers</div>
    </div>
  </div>
  <div style={styles.featuresList}>
    <div style={styles.featureItem}>
      <span style={styles.featureIcon}>📍</span>
      <div>
        <strong>Real-Time Tracking</strong>
        <div style={styles.featureText}>Know where every delivery is, instantly</div>
      </div>
    </div>
    <div style={styles.featureItem}>
      <span style={styles.featureIcon}>🔒</span>
      <div>
        <strong>Proof of Delivery</strong>
        <div style={styles.featureText}>QR code verification prevents fraud</div>
      </div>
    </div>
    <div style={styles.featureItem}>
      <span style={styles.featureIcon}>⚡</span>
      <div>
        <strong>Fast Assignment</strong>
        <div style={styles.featureText}>Assign riders in seconds, not phone calls</div>
      </div>
    </div>
  </div>
</div>

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button style={styles.btnLink} onClick={() => { setShowRegister(!showRegister); setErrorMessage(""); }}>
              {showRegister ? "Already have an account? Sign In" : "Need an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   RETAILER DASHBOARD
========================================================= */

function RetailerDashboard({ user }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [submitting, setSubmitting] = useState(false);
  const [createdDelivery, setCreatedDelivery] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  const retailerId = user.id;

  async function loadRetailerDeliveries() {
    try {
      const response = await fetch(`${API_URL}/deliveries`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load deliveries");
      const retailerDeliveries = data.filter((delivery) => delivery.retailerId === retailerId);
      setDeliveries(retailerDeliveries);
    } catch (error) {
      console.error("Failed to load retailer deliveries:", error);
    } finally {
      setLoadingDeliveries(false);
    }
  }

  useEffect(() => {
    loadRetailerDeliveries();
    const interval = setInterval(loadRetailerDeliveries, 5000);
    return () => clearInterval(interval);
  }, [retailerId]);

  async function createDelivery(e) {
    e.preventDefault();
    setMessage("");
    setCreatedDelivery(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId,
          customerName,
          customerPhone,
          deliveryAddress,
          itemDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create delivery");
      }

      setCreatedDelivery(data);
      setMessage("Delivery request created");
      setMessageType("success");

      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setItemDescription("");

      await loadRetailerDeliveries();
    } catch (error) {
      console.error("Failed to create delivery:", error);
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalDeliveries = deliveries.length;
  const openDeliveries = deliveries.filter((d) => d.status === "OPEN").length;
  const assignedDeliveries = deliveries.filter((d) => d.status === "ASSIGNED").length;
  const deliveredDeliveries = deliveries.filter((d) => d.status === "DELIVERED").length;

  return (
    <>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroLeft}>
            <div style={styles.heroEyebrow}>🏪 RETAILER WORKSPACE</div>
            <h1 style={styles.heroTitle}>Good morning, {user.name}</h1>
            <p style={styles.heroText}>Manage your deliveries and track every order from request to completion.</p>
            <button
              style={styles.primaryButton}
              onClick={() => document.getElementById("create-delivery-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              + New Delivery
            </button>
          </div>
          <div style={styles.heroGraphic}>
            <span style={styles.heroGraphicItem}>📦</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>🛵</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>🏠</span>
          </div>
        </div>
        <div style={styles.heroBottom}>
          <span>REFLEX DELIVERY OPERATIONS</span>
          <span>● SYSTEM READY</span>
        </div>
      </section>

      <AlertMessage type={messageType} message={message} />

      <section style={styles.summary}>
        <StatCard icon="▦" label="TOTAL DELIVERIES" value={totalDeliveries} description="All delivery requests" />
        <StatCard icon="○" label="OPEN" value={openDeliveries} description="Waiting for assignment" tone="blue" />
        <StatCard icon="↗" label="ASSIGNED" value={assignedDeliveries} description="Riders assigned" tone="amber" />
        <StatCard icon="✓" label="DELIVERED" value={deliveredDeliveries} description="Successfully completed" tone="green" />
      </section>

      {createdDelivery && (
        <section style={styles.createdCard}>
          <div style={styles.createdHeader}>
            <div style={styles.createdSuccessIcon}>✓</div>
            <div>
              <div style={styles.createdEyebrow}>DELIVERY CREATED</div>
              <h3 style={styles.createdTitle}>Delivery request created</h3>
              <p style={styles.createdSubtitle}>Your rider can use this code to confirm the delivery.</p>
            </div>
          </div>
          <div style={styles.createdContent}>
            <div style={styles.createdDetails}>
              <InfoRow label="Tracking code" value={createdDelivery.trackingCode} highlight />
              <InfoRow label="Customer" value={createdDelivery.customerName} />
              <InfoRow label="Phone" value={createdDelivery.customerPhone} />
              <InfoRow label="Destination" value={createdDelivery.deliveryAddress} />
              <InfoRow label="Item" value={createdDelivery.itemDescription} />
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <StatusBadge status={createdDelivery.status} />
              </div>
            </div>
            <div style={styles.createdQr}>
              <QRCodeSVG value={createdDelivery.trackingCode} size={120} />
              <span style={styles.qrCaption}>Tracking QR</span>
              <strong>{createdDelivery.trackingCode}</strong>
            </div>
          </div>
        </section>
      )}

      <section id="create-delivery-form" style={styles.formCard}>
        <SectionHeader icon="＋" title="Create Delivery Request" description="Enter the customer and delivery details to create a new request." />
        <form onSubmit={createDelivery}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Name <span style={styles.required}>*</span></label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Mary Wanjiku" style={styles.input} required />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Phone <span style={styles.required}>*</span></label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g. 0712345678" style={styles.input} required />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Delivery Address <span style={styles.required}>*</span></label>
              <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="e.g. Nyeri Town" style={styles.input} required />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Item Description <span style={styles.required}>*</span></label>
              <input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="e.g. Samsung charger" style={styles.input} required />
            </div>
          </div>
          <div style={styles.formFooter}>
            <div style={styles.formHint}>
              <span>✓</span> A unique tracking code will be generated automatically.
            </div>
            <button type="submit" style={styles.primaryButton} disabled={submitting}>
              {submitting ? "Creating..." : "Create Delivery Request"} <span>→</span>
            </button>
          </div>
        </form>
      </section>

      <section>
        <SectionHeader icon="▤" title="Your Deliveries" description="Monitor all delivery requests created by your business." right={<SyncIndicator />} />
        {loadingDeliveries ? (
          <LoadingState text="Loading your deliveries..." />
        ) : deliveries.length === 0 ? (
          <EmptyState icon="📦" title="No deliveries yet" text="Create your first delivery request to get started." />
        ) : (
          <div style={styles.grid}>
            {deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================================
   DISPATCHER DASHBOARD
========================================================= */

function DispatcherDashboard({ user }) {
  const [deliveries, setDeliveries] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  async function loadDispatcherData() {
    try {
      const [deliveriesResponse, usersResponse] = await Promise.all([fetch(`${API_URL}/deliveries`), fetch(`${API_URL}/users`)]);
      const deliveriesData = await deliveriesResponse.json();
      const usersData = await usersResponse.json();

      if (!deliveriesResponse.ok) throw new Error("Failed to load deliveries");
      if (!usersResponse.ok) throw new Error("Failed to load users");

      setDeliveries(deliveriesData);
      setRiders(usersData.filter((u) => u.role === "RIDER"));
    } catch (error) {
      console.error("Failed to load dispatcher data:", error);
      setMessage(error.message);
      setMessageType("error");
    }
  }

  useEffect(() => {
    loadDispatcherData();
    const interval = setInterval(loadDispatcherData, 5000);
    return () => clearInterval(interval);
  }, []);

  function selectRider(deliveryId, riderId) {
    setSelectedRiders((previous) => ({ ...previous, [deliveryId]: riderId }));
  }

  async function assignRider(deliveryId) {
    const riderId = selectedRiders[deliveryId];
    if (!riderId) {
      setMessage("Please select a rider before assigning.");
      setMessageType("error");
      return;
    }

    setAssigning(deliveryId);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/deliveries/${deliveryId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: Number(riderId), dispatcherId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to assign rider");

      setMessage(`${data.trackingCode} assigned successfully.`);
      setMessageType("success");

      setSelectedRiders((previous) => {
        const updated = { ...previous };
        delete updated[deliveryId];
        return updated;
      });

      await loadDispatcherData();
    } catch (error) {
      console.error("Failed to assign rider:", error);
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setAssigning(null);
    }
  }

  const totalDeliveries = deliveries.length;
  const openDeliveries = deliveries.filter((d) => d.status === "OPEN").length;
  const assignedDeliveries = deliveries.filter((d) => d.status === "ASSIGNED").length;
  const pickedUpDeliveries = deliveries.filter((d) => d.status === "PICKED_UP").length;
  const deliveredDeliveries = deliveries.filter((d) => d.status === "DELIVERED").length;

  return (
    <>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroLeft}>
            <div style={styles.heroEyebrow}>📋 DISPATCH CONTROL CENTER</div>
            <h1 style={styles.heroTitle}>Dispatch Control Center</h1>
            <p style={styles.heroText}>Assign riders and monitor delivery operations.</p>
          </div>
          <div style={styles.heroGraphic}>
            <span style={styles.heroGraphicItem}>📋</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>🛵</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>📦</span>
          </div>
        </div>
        <div style={styles.heroBottom}>
          <span>REFLEX DELIVERY OPERATIONS</span>
          <span>● SYSTEM READY</span>
        </div>
      </section>

      <AlertMessage type={messageType} message={message} />

      <section style={styles.summary}>
        <StatCard icon="▦" label="TOTAL DELIVERIES" value={totalDeliveries} description="All delivery requests" />
        <StatCard icon="○" label="OPEN" value={openDeliveries} description="Requiring assignment" tone="blue" />
        <StatCard icon="↗" label="ASSIGNED" value={assignedDeliveries} description="Riders assigned" tone="amber" />
        <StatCard icon="📦" label="PICKED UP" value={pickedUpDeliveries} description="In transit" tone="purple" />
        <StatCard icon="✓" label="DELIVERED" value={deliveredDeliveries} description="Successfully completed" tone="green" />
      </section>

      <section>
        <SectionHeader icon="▤" title="Delivery Queue" description="Review requests and assign available riders." right={<SyncIndicator />} />
        {deliveries.length === 0 ? (
          <EmptyState icon="📋" title="No deliveries in the queue" text="New delivery requests will appear here." />
        ) : (
          <div style={styles.grid}>
            {deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery}>
                {delivery.status === "OPEN" && (
                  <div style={styles.assignBox}>
                    <div style={styles.assignBoxHeader}>
                      <div>
                        <strong>Assign Rider</strong>
                        <div style={styles.mutedText}>Select a rider for this request.</div>
                      </div>
                      <span style={styles.actionRequiredBadge}>ACTION REQUIRED</span>
                    </div>
                    <select value={selectedRiders[delivery.id] || ""} onChange={(e) => selectRider(delivery.id, e.target.value)} style={styles.riderSelect}>
                      <option value="">Select rider...</option>
                      {riders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name} — {rider.phone}
                        </option>
                      ))}
                    </select>
                    <button style={styles.primaryButton} onClick={() => assignRider(delivery.id)} disabled={assigning === delivery.id}>
                      {assigning === delivery.id ? "Assigning..." : "Assign Rider"}
                    </button>
                  </div>
                )}

                {delivery.status !== "OPEN" && delivery.rider && (
                  <div style={styles.riderDisplay}>
                    <div style={styles.avatar}>{delivery.rider.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={styles.mutedText}>Assigned to:</div>
                      <strong>{delivery.rider.name}</strong>
                    </div>
                    <span style={styles.assignedPill}>ASSIGNED</span>
                  </div>
                )}
              </DeliveryCard>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================================
   RIDER DASHBOARD
========================================================= */

function RiderDashboard({ user }) {
  const [deliveries, setDeliveries] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [updating, setUpdating] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [scannedDelivery, setScannedDelivery] = useState(null);
  const scannerRef = useRef(null);

  const riderId = user.id;

  async function loadDeliveries() {
    try {
      const response = await fetch(`${API_URL}/deliveries`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load deliveries");
      setDeliveries(data);
    } catch (error) {
      console.error("Failed to load deliveries:", error);
    }
  }

  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 5000);
    return () => clearInterval(interval);
  }, [riderId]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
  }, []);

  async function updateStatus(deliveryId, newStatus) {
    setUpdating(deliveryId);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/deliveries/${deliveryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId, status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update delivery");

      setMessage(`${data.trackingCode} updated to ${STATUS_META[data.status]?.label || data.status}`);
      setMessageType("success");
      await loadDeliveries();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUpdating(null);
    }
  }

  async function verifyScannedDelivery(trackingCode) {
    try {
      setMessage("Checking delivery...");
      setMessageType("success");
      setScannedDelivery(null);

      const response = await fetch(`${API_URL}/deliveries/tracking/${encodeURIComponent(trackingCode)}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Delivery not found");
      if (data.riderId !== riderId) throw new Error("This delivery is not assigned to you.");

      const confirmResponse = await fetch(`${API_URL}/deliveries/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingCode, riderId }),
      });

      const confirmData = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmData.message || "Failed to confirm delivery");

      setScannedDelivery(confirmData.delivery);
      setMessage(`Order confirmed successfully: ${confirmData.delivery.trackingCode}`);
      setMessageType("success");
      await loadDeliveries();
    } catch (error) {
      console.error("Failed to verify/confirm scanned delivery:", error);
      setMessage(error.message);
      setMessageType("error");
    }
  }

  function startScanner() {
    setScannedCode("");
    setScannedDelivery(null);
    setMessage("");
    setScannerOpen(true);

    setTimeout(() => {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            setScannedCode(decodedText);
            await verifyScannedDelivery(decodedText);
            scanner
              .stop()
              .then(() => {
                scanner.clear();
                if (scannerRef.current === scanner) scannerRef.current = null;
                setScannerOpen(false);
              })
              .catch((error) => console.error("Failed to stop scanner:", error));
          },
          () => {}
        )
        .catch((error) => {
          console.error("Unable to start camera:", error);
          setMessage("Unable to access the camera. Please allow camera permission and try again.");
          setMessageType("error");
          setScannerOpen(false);
        });
    }, 100);
  }

  function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner) {
      scanner
        .stop()
        .then(() => {
          scanner.clear();
          if (scannerRef.current === scanner) scannerRef.current = null;
        })
        .catch((error) => console.error("Failed to stop scanner:", error));
    }
    setScannerOpen(false);
  }

  const myDeliveries = deliveries.filter((delivery) => delivery.riderId === riderId);
  const awaitingPickup = myDeliveries.filter((delivery) => delivery.status === "ASSIGNED").length;
  const pickedUp = myDeliveries.filter((delivery) => delivery.status === "PICKED_UP").length;
  const delivered = myDeliveries.filter((delivery) => delivery.status === "DELIVERED").length;

  return (
    <>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroLeft}>
            <div style={styles.heroEyebrow}>🛵 RIDER WORKSPACE</div>
            <h1 style={styles.heroTitle}>Rider Dashboard</h1>
            <p style={styles.heroText}>Manage your assigned deliveries and confirm completed orders.</p>
          </div>
          <div style={styles.heroGraphic}>
            <span style={styles.heroGraphicItem}>📋</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>🛵</span>
            <span style={styles.heroArrow}>→</span>
            <span style={styles.heroGraphicItem}>✓</span>
          </div>
        </div>
        <div style={styles.heroBottom}>
          <span>REFLEX DELIVERY OPERATIONS</span>
          <span>● SYSTEM READY</span>
        </div>
      </section>

      <AlertMessage type={messageType} message={message} />

      <section style={styles.summary}>
        <StatCard icon="↗" label="ASSIGNED" value={awaitingPickup} description="Ready for pickup" tone="amber" />
        <StatCard icon="📦" label="PICKED UP" value={pickedUp} description="In transit" tone="purple" />
        <StatCard icon="✓" label="DELIVERED" value={delivered} description="Successfully completed" tone="green" />
      </section>

      <section style={styles.scannerCard}>
        <div style={styles.scannerHeader}>
          <div>
            <div style={styles.sectionEyebrow}>PROOF OF DELIVERY</div>
            <h3 style={styles.scannerTitle}>Scan Delivery QR</h3>
            <p style={styles.scannerDescription}>Scan the customer's delivery QR code to confirm the order.</p>
          </div>
          <div style={styles.scannerIcon}>📷</div>
        </div>

        {!scannerOpen ? (
          <button style={styles.primaryButton} onClick={startScanner}>
            Scan QR Code <span>→</span>
          </button>
        ) : (
          <div>
            <div id="qr-reader" style={styles.reader}></div>
            <button style={styles.secondaryButton} onClick={stopScanner}>
              Close Scanner
            </button>
          </div>
        )}

        {scannedCode && (
          <div style={styles.scanResult}>
            <span style={styles.scanResultIcon}>✓</span>
            <div>
              <span style={styles.scanLabel}>Scanned Tracking Code</span>
              <strong>{scannedCode}</strong>
            </div>
          </div>
        )}

        {scannedDelivery && (
          <div style={styles.verifiedResult}>
            <div style={styles.verifiedHeader}>
              <div style={styles.verifiedIcon}>✓</div>
              <div>
                <div style={styles.verifiedEyebrow}>DELIVERY FOUND</div>
                <h4 style={{ margin: 0 }}>{scannedDelivery.trackingCode}</h4>
              </div>
            </div>
            <div style={styles.verifiedGrid}>
              <InfoRow label="Customer" value={scannedDelivery.customerName} />
              <InfoRow label="Phone" value={scannedDelivery.customerPhone} />
              <InfoRow label="Address" value={scannedDelivery.deliveryAddress} />
              <InfoRow label="Item" value={scannedDelivery.itemDescription} />
            </div>
            <button
              style={{ ...styles.primaryButton, marginTop: "15px", width: "100%" }}
              onClick={() => updateStatus(scannedDelivery.id, "DELIVERED")}
              disabled={updating === scannedDelivery.id}
            >
              {updating === scannedDelivery.id ? "Confirming..." : "Confirm Delivery"}
            </button>
          </div>
        )}
      </section>

      <section>
        <SectionHeader icon="🛵" title="My Assigned Deliveries" description="Orders currently assigned to you." right={<SyncIndicator />} />
        {myDeliveries.length === 0 ? (
          <EmptyState icon="🛵" title="No deliveries assigned" text="Your assigned deliveries will appear here." />
        ) : (
          <div style={styles.grid}>
            {myDeliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery}>
                <div style={styles.actions}>
                  {delivery.status === "ASSIGNED" && (
                    <button style={styles.primaryButton} onClick={() => updateStatus(delivery.id, "PICKED_UP")} disabled={updating === delivery.id}>
                      {updating === delivery.id ? "Updating..." : "Mark Picked Up"} <span>→</span>
                    </button>
                  )}
                  {delivery.status === "PICKED_UP" && (
                    <button style={styles.successButton} onClick={() => updateStatus(delivery.id, "DELIVERED")} disabled={updating === delivery.id}>
                      {updating === delivery.id ? "Updating..." : "Mark Delivered"} <span>✓</span>
                    </button>
                  )}
                  {delivery.status === "DELIVERED" && (
                    <div style={styles.completed}>
                      <span>✓</span> Delivered
                    </div>
                  )}
                </div>
              </DeliveryCard>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================================
   GLOBAL STYLES
========================================================= */

const globalStyles = `
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: #f5f7fb;
    color: #172033;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  button, input, select { font: inherit; }
  button {
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  button:hover:not(:disabled) { transform: translateY(-1px); }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: 0.65; cursor: not-allowed; }
  input, select {
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  input:focus, select:focus {
    outline: none;
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  @media (max-width: 760px) {
    .reflex-header { padding: 16px 18px !important; flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
    .reflex-user-area { width: 100% !important; justify-content: space-between !important; }
    .reflex-main { padding: 24px 15px !important; }
    .reflex-hero { padding: 25px !important; }
    .reflex-hero-content { flex-direction: column !important; align-items: flex-start !important; }
    .reflex-hero-graphic { display: none !important; }
    .reflex-form-grid { grid-template-columns: 1fr !important; }
    .reflex-summary { grid-template-columns: repeat(2, 1fr) !important; }
    .reflex-grid { grid-template-columns: 1fr !important; }
    .reflex-card-top { flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
    .reflex-info-grid { grid-template-columns: 1fr !important; }
    .reflex-qr-section { grid-template-columns: 1fr !important; text-align: left !important; }
    .reflex-login-shell { grid-template-columns: 1fr !important; max-width: 500px !important; }
    .reflex-login-brand { display: none !important; }
    .reflex-mobile-brand { display: flex !important; }
  }
  @media (max-width: 480px) {
    .reflex-summary { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .reflex-stat-card { padding: 14px !important; }
    .reflex-stat-icon { width: 36px !important; height: 36px !important; }
    .reflex-stat-number { font-size: 23px !important; }
    .reflex-user-name { display: none !important; }
    .reflex-hero-title { font-size: 27px !important; }
    .reflex-card { padding: 17px !important; }
  }
`;

/* =========================================================
   COMPONENT STYLES
========================================================= */

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb" },
  mainContainer: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "34px 24px 60px",
    width: "100%",
  },

  header: {
    minHeight: "76px",
    padding: "14px 34px",
    background: "white",
    color: "#172033",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  headerBrand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  brandMark: {
    width: "40px",
    height: "40px",
    borderRadius: "11px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "900",
    fontSize: "21px",
    boxShadow: "0 5px 15px rgba(37, 99, 235, 0.35)",
  },

  logo: {
    fontSize: "19px",
    fontWeight: "900",
    letterSpacing: "2.5px",
    color: "#1e3a8a",
  },

  subtitle: {
    marginTop: "2px",
    fontSize: "11px",
    color: "#64748b",
    letterSpacing: "0.2px",
  },

  userArea: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  userAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "18px",
    flexShrink: 0,
  },

  userName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1e293b",
  },

  roleBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    borderRadius: "20px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "11px",
    fontWeight: "700",
  },

  logoutButton: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    background: "transparent",
    color: "#dc2626",
    border: "1px solid #fecaca",
    padding: "8px 14px",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(125deg, #0f1e43 0%, #173574 52%, #2563c7 100%)",
    color: "white",
    padding: "34px",
    borderRadius: "20px",
    marginBottom: "25px",
    boxShadow: "0 15px 35px rgba(23, 54, 116, 0.20)",
  },

  heroContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "40px",
    position: "relative",
    zIndex: 1,
  },

  heroLeft: {
    maxWidth: "650px",
  },

  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "6px 10px",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#bfdbfe",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.1px",
    marginBottom: "14px",
  },

  heroTitle: {
    margin: 0,
    fontSize: "34px",
    lineHeight: "1.15",
    letterSpacing: "-0.7px",
  },

  heroText: {
    margin: "12px 0 20px",
    maxWidth: "610px",
    color: "#dbeafe",
    lineHeight: "1.65",
    fontSize: "15px",
  },

  heroGraphic: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "19px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "15px",
    whiteSpace: "nowrap",
  },

  heroGraphicItem: {
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },

  heroArrow: {
    color: "#93c5fd",
    fontSize: "20px",
  },

  heroBottom: {
    position: "relative",
    zIndex: 1,
    marginTop: "25px",
    paddingTop: "15px",
    borderTop: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "9px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#9fb3d4",
  },

  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "30px",
  },

  statCard: {
    background: "white",
    border: "1px solid #e7ebf2",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.035)",
    transition: "transform 0.2s",
  },

  statIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: "800",
    flexShrink: 0,
  },

  statContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  statNumber: {
    color: "#172033",
    fontSize: "28px",
    lineHeight: "1.1",
    fontWeight: "800",
  },

  statDescription: {
    color: "#94a3b8",
    fontSize: "12px",
    marginTop: "2px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  sectionHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
  },

  sectionIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "#eaf1ff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "17px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#172033",
    letterSpacing: "-0.2px",
  },

  sectionDescription: {
    margin: "2px 0 0",
    color: "#7b8494",
    fontSize: "13px",
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "1.1px",
    marginBottom: "4px",
  },

  formCard: {
    background: "white",
    border: "1px solid #e7ebf2",
    borderRadius: "16px",
    padding: "25px",
    marginBottom: "30px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
  },

  formGroup: {
    marginBottom: "3px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    display: "block",
    color: "#374151",
    fontSize: "13px",
    fontWeight: "700",
  },

  required: {
    color: "#dc2626",
    marginLeft: "3px",
  },

  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #dce2eb",
    borderRadius: "8px",
    color: "#172033",
    background: "#fbfcfe",
    fontSize: "14px",
    height: "48px",
  },

  formFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    marginTop: "21px",
    paddingTop: "19px",
    borderTop: "1px solid #edf0f5",
  },

  formHint: {
    color: "#7b8494",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },

  primaryButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "white",
    border: "none",
    padding: "12px 20px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 5px 13px rgba(37, 99, 235, 0.20)",
  },

  successButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    background: "linear-gradient(135deg, #15803d, #16a34a)",
    color: "white",
    border: "none",
    padding: "12px 17px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 5px 13px rgba(22, 163, 74, 0.18)",
  },

  secondaryButton: {
    background: "#eef2f7",
    color: "#334155",
    border: "1px solid #dce2eb",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "13px",
    width: "100%",
  },

  btnLink: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    textDecoration: "underline",
  },

  message: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "10px",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: "600",
  },

  messageSuccess: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  messageError: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  messageIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.65)",
    fontWeight: "900",
    fontSize: "14px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "20px",
  },

  deliveryCard: {
    background: "white",
    border: "1px solid #e6eaf1",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.045)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    marginBottom: "17px",
  },

  tracking: {
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.4px",
    fontFamily: "monospace",
  },

  customer: {
    color: "#172033",
    fontSize: "18px",
    fontWeight: "800",
    marginTop: "4px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },

  timeline: {
    display: "flex",
    alignItems: "flex-start",
    margin: "24px 0",
    padding: "0 2px",
    position: "relative",
  },

  timelineItem: {
    position: "relative",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  timelineDot: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "#eef1f5",
    border: "2px solid #e1e5eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "12px",
    zIndex: 2,
    transition: "all 0.3s",
  },

  timelineDotComplete: {
    background: "#2563eb",
    borderColor: "#2563eb",
  },

  timelineDotActive: {
    boxShadow: "0 0 0 4px rgba(37,99,235,0.15)",
  },

  timelineLine: {
    position: "absolute",
    height: "2px",
    background: "#e6e9ee",
    width: "100%",
    left: "50%",
    top: "11px",
    zIndex: 1,
  },

  timelineLineComplete: {
    background: "#2563eb",
  },

  timelineLabel: {
    marginTop: "10px",
    color: "#9aa3b2",
    fontSize: "10px",
    fontWeight: "700",
    textAlign: "center",
  },

  timelineLabelActive: {
    color: "#1d4ed8",
    fontWeight: "900",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    padding: "16px 0",
    borderTop: "1px solid #edf0f4",
    borderBottom: "1px solid #edf0f4",
  },

  infoItem: {
    display: "flex",
    gap: "10px",
    minWidth: 0,
    alignItems: "center",
  },

  infoIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "#f1f5f9",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    flexShrink: 0,
  },

  infoContent: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  infoLabel: {
    color: "#8a94a5",
    fontSize: "11px",
    fontWeight: "700",
  },

  infoValue: {
    color: "#344054",
    fontSize: "13px",
    overflowWrap: "anywhere",
    fontWeight: "600",
  },

  cardSection: {
    marginTop: "20px",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "10px",
  },

  cardSectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: "900",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  qrSection: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },

  confirmedBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#15803d",
    fontSize: "13px",
    fontWeight: "700",
    background: "#dcfce7",
    padding: "8px 12px",
    borderRadius: "8px",
  },

  pendingBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#a16207",
    fontSize: "13px",
    fontWeight: "700",
    background: "#fffbeb",
    padding: "8px 12px",
    borderRadius: "8px",
  },

  cardDates: {
    display: "flex",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px dashed #e2e8f0",
  },

  assignBox: {
    marginTop: "20px",
    padding: "20px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "10px",
  },

  assignBoxHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },

  actionRequiredBadge: {
    background: "#fef3c7",
    color: "#b45309",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.5px",
  },

  riderSelect: {
    width: "100%",
    padding: "12px",
    background: "white",
    border: "1px solid #d5dce7",
    borderRadius: "8px",
    color: "#344054",
    fontSize: "14px",
    marginBottom: "12px",
    height: "48px",
  },

  riderDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "20px",
    padding: "16px",
    background: "#f0fdf4",
    borderRadius: "10px",
    border: "1px solid #bbf7d0",
  },

  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "16px",
  },

  mutedText: {
    color: "#8a94a5",
    fontSize: "11px",
    marginTop: "2px",
  },

  assignedPill: {
    marginLeft: "auto",
    color: "#15803d",
    background: "#dcfce7",
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "900",
  },

  actions: {
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  completed: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    padding: "12px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "900",
  },

  history: {
    marginTop: "24px",
    paddingTop: "20px",
    borderTop: "1px solid #edf0f4",
  },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: "12px",
    fontWeight: "900",
    marginBottom: "16px",
  },

  historyCount: {
    color: "#9aa3b2",
    fontWeight: "600",
  },

  historyRow: {
    display: "flex",
    gap: "12px",
    minHeight: "40px",
  },

  historyMarker: {
    width: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  historyDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#2563eb",
    marginTop: "6px",
    flexShrink: 0,
  },

  historyConnector: {
    width: "2px",
    flex: 1,
    background: "#dce3ec",
    marginTop: "4px",
  },

  historyContent: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingBottom: "12px",
  },

  historyTime: {
    color: "#9aa3b2",
    fontSize: "11px",
  },

  noHistory: {
    color: "#9aa3b2",
    fontSize: "12px",
    fontStyle: "italic",
  },

  createdCard: {
    background: "linear-gradient(135deg, #f0fdf4, #f8fffa)",
    border: "1px solid #bbf7d0",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "30px",
  },

  createdHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },

  createdSuccessIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#dcfce7",
    color: "#15803d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "900",
  },

  createdEyebrow: {
    color: "#15803d",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    marginBottom: "4px",
  },

  createdTitle: {
    margin: "0 0 4px",
    color: "#166534",
    fontSize: "18px",
  },

  createdSubtitle: {
    margin: 0,
    color: "#4d7c5a",
    fontSize: "13px",
  },

  createdContent: {
    display: "grid",
    gridTemplateColumns: "1fr 200px",
    gap: "24px",
  },

  createdDetails: {
    background: "white",
    border: "1px solid #dcfce7",
    borderRadius: "10px",
    padding: "16px",
  },

  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    padding: "10px 0",
    borderBottom: "1px solid #f0f2f5",
    fontSize: "13px",
  },

  detailLabel: {
    color: "#8a94a5",
    fontWeight: "600",
  },

  detailValue: {
    color: "#344054",
    textAlign: "right",
  },

  detailHighlight: {
    color: "#1d4ed8",
    fontWeight: "900",
    fontFamily: "monospace",
    fontSize: "14px",
  },

  createdQr: {
    background: "white",
    border: "1px solid #dcfce7",
    borderRadius: "10px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "#166534",
  },

  qrCaption: {
    color: "#8a94a5",
    fontSize: "11px",
  },

  scannerCard: {
    background: "white",
    border: "1px solid #e7ebf2",
    borderRadius: "16px",
    padding: "28px",
    marginBottom: "30px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  },

  scannerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },

  scannerTitle: {
    margin: 0,
    color: "#172033",
    fontSize: "22px",
  },

  scannerDescription: {
    color: "#7b8494",
    fontSize: "14px",
    margin: "6px 0 0",
  },

  scannerIcon: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },

  reader: {
    maxWidth: "480px",
    margin: "20px auto 0",
    borderRadius: "12px",
    overflow: "hidden",
  },

  scanResult: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "20px",
    padding: "16px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
    color: "#1e40af",
  },

  scanResultIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
  },

  scanLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    marginBottom: "4px",
  },

  verifiedResult: {
    marginTop: "24px",
    padding: "24px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "12px",
  },

  verifiedHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },

  verifiedIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "#dcfce7",
    color: "#15803d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "20px",
  },

  verifiedEyebrow: {
    color: "#15803d",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.9px",
    marginBottom: "4px",
  },

  verifiedGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0 24px",
  },

  sync: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
  },

  syncDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.2)",
  },

  empty: {
    background: "white",
    border: "1px solid #e7ebf2",
    borderRadius: "16px",
    padding: "60px 20px",
    textAlign: "center",
  },

  emptyIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "#eff6ff",
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
  },

  emptyTitle: {
    margin: "0 0 8px",
    color: "#344054",
    fontSize: "18px",
  },

  emptyText: {
    margin: 0,
    color: "#8a94a5",
    fontSize: "14px",
  },

  loadingIcon: {
    fontSize: "32px",
    color: "#2563eb",
    marginBottom: "12px",
    animation: "spin 1s linear infinite",
  },

  loginPage: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #edf3ff 0%, #f8fafc 50%, #eef4ff 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "25px",
  },

  loginShell: {
    width: "100%",
    maxWidth: "1000px",
    minHeight: "600px",
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    background: "white",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 25px 70px rgba(15, 23, 42, 0.13)",
    border: "1px solid #e5eaf2",
  },

  loginBrandPanel: {
    position: "relative",
    overflow: "hidden",
    padding: "40px",
    background:
      "linear-gradient(145deg, #0b1736 0%, #142653 55%, #1e4fa8 100%)",
    color: "white",
    display: "flex",
    flexDirection: "column",
  },

  loginBrandTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  brandMarkLarge: {
    width: "48px",
    height: "48px",
    borderRadius: "13px",
    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "900",
    fontSize: "25px",
  },

  loginBrandName: {
    fontSize: "22px",
    fontWeight: "900",
    letterSpacing: "3px",
  },

  loginBrandTag: {
    color: "#93c5fd",
    fontSize: "8px",
    letterSpacing: "1.4px",
    marginTop: "3px",
  },

  loginBrandContent: {
    marginTop: "80px",
  },

  loginEyebrow: {
    color: "#93c5fd",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "1.2px",
    marginBottom: "13px",
  },

  loginHeroTitle: {
    margin: 0,
    fontSize: "38px",
    lineHeight: "1.12",
    letterSpacing: "-1px",
  },

  loginHeroText: {
    maxWidth: "440px",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: "1.7",
    marginTop: "15px",
  },

  loginFlow: {
    display: "flex",
    alignItems: "center",
    marginTop: "40px",
  },

  loginFlowItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    color: "#dbeafe",
    fontSize: "9px",
    fontWeight: "700",
  },

  loginFlowIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.09)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
  },

  loginFlowLine: {
    width: "30px",
    height: "1px",
    background: "rgba(147,197,253,0.35)",
    margin: "0 6px 20px",
  },

  loginBrandFooter: {
    marginTop: "auto",
    paddingTop: "20px",
    borderTop: "1px solid rgba(255,255,255,0.10)",
    color: "#94a3b8",
    fontSize: "10px",
  },

  loginCard: {
    padding: "45px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  mobileLoginBrand: {
    display: "none",
    alignItems: "center",
    gap: "9px",
    color: "#172554",
    fontSize: "18px",
    letterSpacing: "2px",
    marginBottom: "25px",
  },

  loginHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "28px",
  },

  loginWelcomeIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "19px",
  },

  loginTitle: {
    margin: 0,
    color: "#172033",
    fontSize: "25px",
    letterSpacing: "-0.5px",
  },

  loginDescription: {
    margin: "3px 0 0",
    color: "#8a94a5",
    fontSize: "13px",
  },

  loginButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "linear-gradient(135deg, #172554, #2563eb)",
    color: "white",
    border: "none",
    padding: "14px",
    borderRadius: "10px",
    fontWeight: "800",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "10px",
    boxShadow: "0 7px 17px rgba(37, 99, 235, 0.20)",
  },

  spinner: {
    fontSize: "18px",
  },

  demoBox: {
    marginTop: "30px",
    padding: "16px",
    background: "#f8fafc",
    border: "1px solid #e8edf3",
    borderRadius: "10px",
  },

  demoHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },

  demoIcon: {
    fontSize: "17px",
  },

  demoSubtitle: {
    color: "#8a94a5",
    fontSize: "11px",
    marginTop: "2px",
  },

  demoAccounts: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  },

  demoAccount: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    background: "white",
    border: "1px solid #e7ebf1",
    borderRadius: "8px",
  },

  demoAccountIcon: {
    fontSize: "16px",
  },

  demoAccountInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },

  demoPassword: {
    marginTop: "12px",
    color: "#7b8494",
    fontSize: "11px",
    textAlign: "center",
  },

  authForm: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  /* =========================================================
     ADMIN DASHBOARD / USER CREATION
  ========================================================= */

  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    fontSize: "14px",
  },

  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "16px",
    fontSize: "14px",
  },

  addUserForm: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "20px",
  },

  formLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#334155",
    marginBottom: "6px",
  },

  formInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "14px",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr",
    gap: "20px",
    marginBottom: "30px",
  },

  panel: {
    background: "white",
    border: "1px solid #e7ebf2",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  tableHeader: {
    textAlign: "left",
    padding: "12px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "1px solid #e2e8f0",
  },

  tableCell: {
    padding: "14px 12px",
    borderBottom: "1px solid #edf0f4",
    color: "#344054",
    fontSize: "13px",
  },

  adminStatusList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "20px",
  },

  adminStatusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "13px 14px",
    background: "#f8fafc",
    borderRadius: "9px",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "600",
  },

  adminRoleSummary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    paddingTop: "16px",
    borderTop: "1px solid #edf0f4",
  },

  adminRoleSummaryItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px",
    background: "#f8fafc",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#475569",
  },
};

export default App;