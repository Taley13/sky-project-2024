/**
 * Sky Template - Booking Frontend Example
 * Include this script on a booking page to display a booking form
 *
 * Required HTML:
 *   <div id="bookingWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/booking.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('bookingWidget');
    if (!widget) return;

    let services = [];
    let selectedService = null;
    let selectedDate = null;

    // Render widget
    function render() {
        widget.innerHTML = `
            <div class="booking-widget">
                <h3>Book an Appointment</h3>

                <div class="booking-step" id="stepService">
                    <label>Select Service:</label>
                    <select id="serviceSelect">
                        <option value="">-- Choose a service --</option>
                        ${services.map(s => `<option value="${s.id}" data-price="${s.price}">${s.name} (${s.duration_minutes} min) - ${s.price} PLN</option>`).join('')}
                    </select>
                </div>

                <div class="booking-step" id="stepDate" style="display:none;">
                    <label>Select Date:</label>
                    <input type="date" id="dateSelect" min="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="booking-step" id="stepTime" style="display:none;">
                    <label>Available Times:</label>
                    <div id="timeSlots" class="time-slots-grid"></div>
                </div>

                <div class="booking-step" id="stepForm" style="display:none;">
                    <form id="bookingForm">
                        <input type="hidden" id="bookingDatetime" name="datetime">
                        <input type="hidden" id="bookingServiceId" name="service_id">
                        <div class="form-group">
                            <label>Your Name *</label>
                            <input type="text" name="client_name" required placeholder="Full name">
                        </div>
                        <div class="form-group">
                            <label>Phone *</label>
                            <input type="tel" name="client_phone" required placeholder="+48...">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="client_email" placeholder="your@email.com">
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" rows="3" placeholder="Any special requests..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Confirm Booking</button>
                    </form>
                </div>

                <div id="bookingSuccess" style="display:none;" class="booking-success">
                    <h4>Booking Confirmed!</h4>
                    <p>We'll contact you to confirm the details.</p>
                </div>
            </div>
        `;

        // Events
        document.getElementById('serviceSelect').addEventListener('change', onServiceSelect);
        document.getElementById('dateSelect')?.addEventListener('change', onDateSelect);
        document.getElementById('bookingForm')?.addEventListener('submit', onSubmit);
    }

    async function loadServices() {
        try {
            const res = await fetch(`${API}/bookings/services`);
            if (res.ok) services = await res.json();
            render();
        } catch (e) {
            widget.innerHTML = '<p>Booking system unavailable</p>';
        }
    }

    function onServiceSelect(e) {
        selectedService = e.target.value;
        if (selectedService) {
            document.getElementById('stepDate').style.display = 'block';
        }
    }

    async function onDateSelect(e) {
        selectedDate = e.target.value;
        if (!selectedDate || !selectedService) return;

        try {
            const res = await fetch(`${API}/bookings/availability/${selectedService}/${selectedDate}`);
            if (!res.ok) return;
            const data = await res.json();

            const container = document.getElementById('timeSlots');
            container.innerHTML = data.slots.map(slot => `
                <button type="button" class="time-slot ${slot.available ? '' : 'unavailable'}"
                        data-datetime="${slot.datetime}" ${slot.available ? '' : 'disabled'}>
                    ${slot.datetime.split('T')[1]}
                </button>
            `).join('');

            document.getElementById('stepTime').style.display = 'block';

            container.querySelectorAll('.time-slot:not(.unavailable)').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    document.getElementById('bookingDatetime').value = btn.dataset.datetime;
                    document.getElementById('bookingServiceId').value = selectedService;
                    document.getElementById('stepForm').style.display = 'block';
                });
            });
        } catch (e) {}
    }

    async function onSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());

        try {
            const res = await fetch(`${API}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                form.parentElement.style.display = 'none';
                document.getElementById('bookingSuccess').style.display = 'block';
            } else {
                const err = await res.json();
                alert(err.error || 'Booking failed');
            }
        } catch (e) {
            alert('Connection error');
        }
    }

    loadServices();
});
