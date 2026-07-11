import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCodeCreator from '../../pages/QRCodeCreator';
import { BrowserRouter } from 'react-router-dom'; // Needed because you use <Link>

describe('QRCodeCreator Component', () => {
    it('renders the initial layout correctly', () => {
        render(
            <BrowserRouter>
                <QRCodeCreator />
            </BrowserRouter>
        );

        const headerElement = screen.getByText('Content');
        expect(headerElement).toBeInTheDocument();
        screen.debug()
    })
    it('switches to Wi-Fi inputs when the Wi-Fi button is clicked', async () => {
  // 1. Setup the user robot
        const user = userEvent.setup();
        render(<BrowserRouter><QRCodeCreator /></BrowserRouter>);
        // 2. Find the Wi-Fi button. 
        // (We use getByRole because it's more specific than getByText)
        const wifiButton = screen.getByRole('button', { name: /Wi-Fi/i });
        // 3. Command the robot to click it
        await user.click(wifiButton);
        // 4. Assert that the Network Name input suddenly appeared on the screen
        // We use getByPlaceholderText to find inputs
        const ssidInput = screen.getByPlaceholderText('Network Name (SSID)');
        expect(ssidInput).toBeInTheDocument();
   });
})