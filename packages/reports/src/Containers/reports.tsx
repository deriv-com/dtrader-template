import React from 'react';
import { RouteComponentProps } from 'react-router-dom';

import { Div100vhContainer, FadeWrapper, Loading, PageOverlay, SelectNative, VerticalTab } from '@deriv/components';
import { getSelectedRoute } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { useTranslations } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import { TRoute } from 'Types';

import 'Sass/app/modules/reports.scss';

type TReports = {
    history: RouteComponentProps['history'];
    location: RouteComponentProps['location'];
    routes: TRoute[];
};

// Security: Allowed domains for redirect functionality
const ALLOWED_REDIRECT_DOMAINS = [
    'deriv.com',
    'deriv.be',
    'deriv.me',
    'app.deriv.com',
    'app.deriv.be',
    'app.deriv.me',
    // Add other trusted Deriv domains as needed
];

// Security: Validate redirect URL to prevent open redirect attacks
const isAllowedRedirectDomain = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Check if hostname exactly matches or is a subdomain of allowed domains
        return ALLOWED_REDIRECT_DOMAINS.some(domain => 
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
};

// Security: Sanitize URL to prevent XSS attacks
const sanitizeUrl = (url: string): string => {
    // Remove any HTML tags and script content
    return url.replace(/<[^>]*>/g, '')
              .replace(/javascript:/gi, '')
              .replace(/data:/gi, '')
              .replace(/vbscript:/gi, '')
              .replace(/file:/gi, '')
              .replace(/blob:/gi, '');
};

const Reports = observer(({ history, location, routes }: TReports) => {
    const { localize } = useTranslations();
    const { client, common, ui } = useStore();

    const { is_logged_in, is_logging_in } = client;
    const { routeBackInApp } = common;
    const { is_reports_visible, setReportsTabIndex, toggleReports } = ui;
    const { isMobile } = useDevice();

    // Store the redirect parameter when component mounts to preserve it across tab navigation
    const redirectUrlRef = React.useRef<string | null>(null);

    // Ref to prevent duplicate analytics calls
    const analyticsCalledRef = React.useRef<boolean>(false);

    React.useEffect(() => {
        // Security: Capture and validate redirect parameter on mount
        const urlParams = new URLSearchParams(location.search);
        const redirectUrl = urlParams.get('redirect');
        if (redirectUrl) {
            // Security: Sanitize the URL first
            const sanitizedUrl = sanitizeUrl(redirectUrl);
            
            // Security: URL length validation (prevent DoS)
            if (sanitizedUrl.length > 2048) {
                console.warn('Security: Blocked excessively long redirect URL');
                return;
            }

            try {
                // Security: Decode URL multiple times to handle encoding attacks
                let decodedUrl = sanitizedUrl;
                let previousUrl = '';
                let decodeAttempts = 0;
                const MAX_DECODE_ATTEMPTS = 5;

                while (decodedUrl !== previousUrl && decodedUrl.includes('%') && decodeAttempts < MAX_DECODE_ATTEMPTS) {
                    previousUrl = decodedUrl;
                    try {
                        decodedUrl = decodeURIComponent(decodedUrl);
                        decodeAttempts++;
                    } catch {
                        console.warn('Security: Blocked redirect URL with invalid encoding');
                        return;
                    }
                }

                // Security: Normalize and trim the URL
                decodedUrl = decodedUrl.trim();

                // Security: Handle protocol-relative URLs
                if (decodedUrl.startsWith('//')) {
                    decodedUrl = `https:${decodedUrl}`;
                }

                // Security: Add protocol if missing
                if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
                    decodedUrl = `https://${decodedUrl}`;
                }

                // Security: Final validation against allowed domains
                if (isAllowedRedirectDomain(decodedUrl)) {
                    redirectUrlRef.current = decodedUrl;
                } else {
                    console.warn('Security: Blocked redirect to unauthorized domain');
                }
            } catch (error) {
                console.warn('Security: Redirect validation error:', error instanceof Error ? error.message : 'Unknown error');
            }
        }
    }, []); // Only run on mount

    React.useEffect(() => {
        // Prevent duplicate analytics calls if component remounts
        if (analyticsCalledRef.current) {
            return;
        }

        analyticsCalledRef.current = true;

        toggleReports(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onClickClose = () => {
        sessionStorage.removeItem('open_positions_filter');

        // Security: Check for validated redirect parameter
        if (redirectUrlRef.current) {
            // Security: Final validation before redirect
            if (isAllowedRedirectDomain(redirectUrlRef.current)) {
                window.location.href = redirectUrlRef.current;
            } else {
                console.warn('Security: Blocked redirect attempt to unauthorized domain');
                routeBackInApp(history);
            }
        } else {
            // If no redirect parameter, use existing logic
            routeBackInApp(history);
        }
    };

    const handleRouteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        // Security: Sanitize the route value before using it
        const newPath = sanitizeUrl(e.target.value);
        
        // Security: Validate that the new path is one of our allowed routes
        const isValidRoute = routes.some(route => route.path === newPath);
        if (!isValidRoute) {
            console.warn('Security: Attempted navigation to unauthorized route');
            return;
        }

        // Preserve redirect parameter when changing routes
        if (redirectUrlRef.current) {
            const redirectParam = `?redirect=${encodeURIComponent(redirectUrlRef.current)}`;
            history.push(`${newPath}${redirectParam}`);
        } else {
            history.push(newPath);
        }
    };

    const menu_options = () => {
        return routes.map(route => ({
            default: route.default,
            icon: route.icon_component,
            label: route.getTitle(),
            value: route.component,
            // Keep path clean for React Router - don't include query parameters
            path: route.path,
            // Store the full path with query params for navigation purposes
            fullPath: redirectUrlRef.current
                ? `${route.path}?redirect=${encodeURIComponent(redirectUrlRef.current)}`
                : route.path,
        }));
    };

    const selected_route = getSelectedRoute({ routes, pathname: location.pathname });

    if (!is_logged_in && is_logging_in) {
        return <Loading is_fullscreen />;
    }

    return (
        <FadeWrapper is_visible={is_reports_visible} className='reports-page-wrapper' keyname='reports-page-wrapper'>
            <div className='reports'>
                <PageOverlay header={localize('Reports')} onClickClose={onClickClose}>
                    {!isMobile ? (
                        <VerticalTab
                            is_floating
                            current_path={location.pathname}
                            is_routed
                            is_full_width
                            setVerticalTabIndex={setReportsTabIndex}
                            list={menu_options()}
                        />
                    ) : (
                        <Div100vhContainer className='reports__mobile-wrapper' height_offset='80px'>
                            <SelectNative
                                className='reports__route-selection'
                                list_items={menu_options().map(option => ({
                                    text: option.label,
                                    value: option.path ?? '',
                                }))}
                                value={selected_route.path ?? ''}
                                should_show_empty_option={false}
                                onChange={handleRouteChange}
                                label={''}
                                hide_top_placeholder={false}
                            />
                            {selected_route?.component && (
                                <selected_route.component icon_component={selected_route.icon_component} />
                            )}
                        </Div100vhContainer>
                    )}
                </PageOverlay>
            </div>
        </FadeWrapper>
    );
});

export default Reports;