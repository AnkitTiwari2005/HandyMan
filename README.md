<div align="center">

# 🔧 HandyMan
### *Field Operating System & Partner App for Houserve*

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

<p>
  <strong>HandyMan</strong> is the professional technician and service-partner companion app to <strong>Houserve</strong>. It empowers electricians, plumbers, carpenters, painters, appliance repair technicians, and cleaners to manage their on-field operations, accept customer bookings in real-time, navigate to job sites, verify service delivery, and manage daily payouts.
</p>

</div>

---

## ⚡ Key Highlights & Features

- **📡 Realtime Job Radar**: Instant broadcast of newly booked Houserve orders with looping audible chimes, tactile haptic alerts, and a 45-second decision timer.
- **🔒 Race-Condition Proof Claims**: Atomic PostgreSQL stored procedure (`claim_booking`) locks rows using `FOR UPDATE`, ensuring two technicians cannot claim the same booking.
- **🛡️ Customer Start OTP**: Eliminates false presence claims by requiring technicians to input the 4-digit verification code from the customer's Houserve app.
- **📸 Visual Job Proof**: Optional Before & After photo uploads stored directly in Supabase Storage (`job-proofs`) for dispute protection.
- **💰 Automatic Wallet & Payout Ledger**: Instantly credits partner earnings (80% take-home) upon service completion and supports withdrawals to UPI / Bank accounts.
- **🧭 Turn-by-Turn Navigation**: Direct deep-linking into Google Maps using coordinates or full address snapshots, plus one-tap WhatsApp and phone calling.
- **🛠️ Dynamic Trade & Radius Management**: Multi-select trade specialties (Electrical, Appliance Repair, Plumbing, Carpentry, Painting, Cleaning, Pest Control) and adjustable service radiuses (5km - 30km).

---

## 🏗️ Architecture & Ecosystem Sync

```
[ HOUSERVE APP (Customer) ]             [ HANDYMAN APP (Partner) ]
  • Places booking                        • Radar listens via Realtime
  • Pays online (Razorpay)                • Claims job atomically (claim_booking)
  • Displays Start OTP                    • Inputs Start OTP (verify_start_otp)
  • Live step progress tracking ◄────────► • Advances lifecycle (accepted -> on_the_way -> in_progress -> completed)
```

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v4 (Industrial high-contrast dark theme)
- **State Management**: Zustand (with localStorage persistence)
- **Database & Realtime**: Supabase PostgreSQL with Row Level Security & WebSockets
- **Audio & Haptics**: Web Audio API tone synthesizer + Capacitor Haptics
- **Mobile Container**: Capacitor ready (Android/iOS)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=HandyMan
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

<div align="center">
  <sub>Built with precision for the Houserve Home Services Ecosystem.</sub>
</div>
