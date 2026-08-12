import { Route, Routes } from "react-router-dom";

import { CheckoutPage } from "./pages/checkout-page";
import { EventDetailsPage } from "./pages/event-details-page";
import { EventsPage } from "./pages/events-page";
import { LoginPage } from "./pages/login-page";
import { SharedTicketPage } from "./pages/shared-ticket-page";
import { TicketsPage } from "./pages/tickets-page";

function App() {
  return (
    <Routes>
      <Route path="/" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/checkout/:reservationId" element={<CheckoutPage />} />
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/tickets/:code" element={<SharedTicketPage />} />
    </Routes>
  );
}

export default App;
