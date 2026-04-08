# UI/UX Specification: Mighty Game

## 1. Design Language & Atmosphere
The design aims for a **Premium, Modern, and Interactive** experience, drawing inspiration from high-end online card games.

- **Theme**: Dark-centric with muted blue/grey backgrounds to reduce eye strain.
- **Vibe**: Sleek, airy, and professional. Use of glassmorphism and subtle gradients.
- **Animation**: Fluid transitions using **Anime.js** and **GSAP**. Smooth card movements and interactive hover states.

## 2. Token-Based Design System

### 2.1 Color Palette
- **Primary**: Royal Purple (`#a855f7`) - Used for primary action buttons, headers, and Joker identity.
- **Accent**: Crimson Pink (`#ff2e63`) - Used for active turn indicators and critical highlights.
- **Surface**: Midnight Jet (`#0a0a0a`) - Base background for reduced eye strain.
- **Success**: Emerald (`#10b981`) - Used for winning outcomes and Clover suit.

### 2.2 Typography
- **Font Family**: *Inter* or *Outfit* (Google Fonts) for a clean, sans-serif look.
- **Hierarchy**: Large semi-bold headers for phase announcements; medium weights for player names and chat.

### 2.3 Geometry & Shape
- **Roundness**: Generously rounded corners (`rounded-xl` / `12px`) for cards and containers.
- **Elevation**: Whisper-soft diffused shadows for depth in the game table.

## 3. Key UI Components

### 3.1 Game Table
- **Circular Layout**: 5 player seating positions arranged around a central "Trick Area".
- **Turn Indicator**: A glowing ring or highlight moving between players to indicate the active turn.

### 3.2 Bidding Modal
- **Interactive Selectors**: Grid of numbers (13-20) and suit icons for quick selection.
- **Real-time Validation**: Disables invalid bids (e.g., lower than current high) instantly.

### 3.3 Exchange Panel
- **Slide-In Animation**: Appears when the Master wins the bid.
- **Interaction**: Click cards to "Mark for Discard"; confirm with a prominent "Replace Cards" button.

### 3.4 Chat & Log
- **Message List**: Collapsible side panel for player communication and system event logging.
- **System Events**: Unique colors for bidding announcements vs. trick outcomes.

## 4. Interaction Patterns
- **Hover States**: Cards lift slightly when hovered.
- **Click Feedback**: Subtle shrink or pulse effect on selection.
- **Phase Transitions**: Background color or lighting adjustments when shifting from Bidding to Playing.
