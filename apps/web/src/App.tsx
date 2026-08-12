import { Route, Routes } from "react-router-dom";

import { CheckoutPage } from "./pages/checkout-page";
import { EventDetailsPage } from "./pages/event-details-page";
import { EventsPage } from "./pages/events-page";
import { LoginPage } from "./pages/login-page";
import { SharedTicketPage } from "./pages/shared-ticket-page";
import { TicketsPage } from "./pages/tickets-page";
import { RegisterPage } from "./pages/register-page";
import { GatePage } from "./pages/gate-page";
import { OrganizerEventsPage } from "./pages/organizer-events-page";
import { CreateEventPage } from "./pages/create-event-page";

function App() {
  return (
    <Routes>
      <Route path="/" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/checkout/:reservationId" element={<CheckoutPage />} />
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/tickets/:code" element={<SharedTicketPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/gate" element={<GatePage />} />
      <Route path="/organizer/events" element={<OrganizerEventsPage />} />
      <Route path="/organizer/events/new" element={<CreateEventPage />} />
    </Routes>
  );
}

export default App;
