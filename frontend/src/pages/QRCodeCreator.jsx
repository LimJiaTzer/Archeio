import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, Download, AlertTriangle, ShieldCheck, X,
  Link as LinkIcon, Type, Wifi, Phone, Mail
} from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import jsQR from 'jsqr';
import { toPng, toJpeg, toSvg } from 'html-to-image';

const downloadBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = fileName;
    link.click();

    setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1000);
};

const loadImageFromUrl = (src) => {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load QR code image.'));
        image.src = src;
    });
};

const svgBlobToPngBlob = async (svgBlob) => {
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const image = await loadImageFromUrl(svgUrl);
        const width = image.naturalWidth || image.width || 280;
        const height = image.naturalHeight || image.height || 280;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not create canvas context.');
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        return await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to export transparent QR code.'));
                    return;
                }

                resolve(blob);
            }, 'image/png');
        });
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
};

export default function QRCodeCreator() {
    const [fmt, setFmt] = useState("PNG");
    const qrRef = useRef(null);
    const frameContainerRef = useRef(null);
    const qrCodeInstanceRef = useRef(null);
    const formats = ["PNG", "JPEG", "SVG"];
    const [isScannable, setIsScannable] = useState(true);
    
    const [activeTab, setActiveTab] = useState('frame'); 

    // New Dynamic Content State
    const [contentType, setContentType] = useState('link');
    const [contentData, setContentData] = useState({
        url: "",
        text: "",
        wifiSsid: "",
        wifiPassword: "",
        wifiEncryption: "WPA",
        phone: "",
        email: "",
        emailSubject: "",
        emailBody: ""
    });

    const [options, setOptions] = useState({
        text: "",
        bgColor: "#FFFFFF",
        bgTransparent: false,
        dotsColor: "#000000",
        dotsType: "square",
        gradientEnabled: false,
        gradientColor: "#4f46e5",
        eyeBorderType: "square",
        eyeBorderColor: "#000000",
        eyeCenterType: "square",
        eyeCenterColor: "#000000",
        logo: null,
        logoSize: 0.3,
        excavate: false,
        frameStyle: "none", 
        frameColor: "#000000",
        frameTextColor: "#FFFFFF",
        frameText: "SCAN ME",
    });

    const patternOptions = [
        { label: 'Square', value: 'square', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h5v5H3zM10 3h5v5h-5zM17 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5zM17 10h5v5h-5zM3 17h5v5H3zM10 17h5v5h-5zM17 17h5v5h-5z"/></svg> },
        { label: 'Dots', value: 'dots', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="5.5" r="2.5"/><circle cx="12.5" cy="5.5" r="2.5"/><circle cx="19.5" cy="5.5" r="2.5"/><circle cx="5.5" cy="12.5" r="2.5"/><circle cx="12.5" cy="12.5" r="2.5"/><circle cx="19.5" cy="12.5" r="2.5"/><circle cx="5.5" cy="19.5" r="2.5"/><circle cx="12.5" cy="19.5" r="2.5"/><circle cx="19.5" cy="19.5" r="2.5"/></svg> },
        { label: 'Rounded', value: 'rounded', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.5"/><rect x="10" y="3" width="5" height="5" rx="1.5"/><rect x="17" y="3" width="5" height="5" rx="1.5"/><rect x="3" y="10" width="5" height="5" rx="1.5"/><rect x="10" y="10" width="5" height="5" rx="1.5"/><rect x="17" y="10" width="5" height="5" rx="1.5"/><rect x="3" y="17" width="5" height="5" rx="1.5"/><rect x="10" y="17" width="5" height="5" rx="1.5"/><rect x="17" y="17" width="5" height="5" rx="1.5"/></svg> },
        { label: 'Classy', value: 'classy', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v5H3zM13 3h8v5h-8zM3 10h5v8H3zM10 10h11v5H10zM17 17h4v4h-4zM10 17h5v4h-5zM3 20h5v3H3z"/></svg> },
        { label: 'Classy Rounded', value: 'classy-rounded', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="5" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="3" y="10" width="5" height="8" rx="2"/><rect x="10" y="10" width="11" height="5" rx="2"/><rect x="17" y="17" width="4" height="4" rx="2"/><rect x="10" y="17" width="5" height="4" rx="2"/><rect x="3" y="20" width="5" height="3" rx="1.5"/></svg> },
        { label: 'Extra Rounded', value: 'extra-rounded', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="5.5" r="3.5"/><circle cx="12.5" cy="5.5" r="3.5"/><circle cx="19.5" cy="5.5" r="3.5"/><circle cx="5.5" cy="12.5" r="3.5"/><circle cx="12.5" cy="12.5" r="3.5"/><circle cx="19.5" cy="12.5" r="3.5"/><circle cx="5.5" cy="19.5" r="3.5"/><circle cx="12.5" cy="19.5" r="3.5"/><circle cx="19.5" cy="19.5" r="3.5"/></svg> }
    ];

    const eyeBorderOptions = [
        { label: 'Square', value: 'square', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" /></svg> },
        { label: 'Circle', value: 'dot', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" /></svg> },
        { label: 'Rounded Square', value: 'extra-rounded', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="6" /></svg> }
    ];

    const eyeCenterOptions = [
        { label: 'Square', value: 'square', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg> },
        { label: 'Circle', value: 'dot', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg> }
    ];

    useEffect(() => {
        qrCodeInstanceRef.current = new QRCodeStyling({
            width: 280,
            height: 280,
            type: "canvas",
            data: "https://example.com", 
            dotsOptions: { type: "square", color: "#000000" },
            backgroundOptions: { color: "#ffffff" },
        });

        const currentQrRef = qrRef.current;

        if (currentQrRef) {
            qrCodeInstanceRef.current.append(currentQrRef);
        }
        
        return () => {
             if (currentQrRef) {
                currentQrRef.innerHTML = '';
             }
        }
    }, []);

    const checkScanability = () => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector('canvas');
        if (!canvas || canvas.width === 0 || canvas.height === 0) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if(!ctx) return;
        
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            setIsScannable(!!code);
        } catch (e) {
            console.error("Scanability check failed", e);
            setIsScannable(false);
        }
    };

    useEffect(() => {
        if (!qrCodeInstanceRef.current) return;

        let qrData = "https://example.com";

        switch (contentType) {
            case 'link':
                qrData = contentData.url || "https://example.com";
                break;
            case 'text':
                qrData = contentData.text || "Hello World";
                break;
            case 'wifi':
                qrData = `WIFI:T:${contentData.wifiEncryption};S:${contentData.wifiSsid};P:${contentData.wifiPassword};;`;
                break;
            case 'phone':
                qrData = `tel:${contentData.phone || '1234567890'}`;
                break;
            case 'email':
                qrData = `mailto:${contentData.email}?subject=${encodeURIComponent(contentData.emailSubject)}&body=${encodeURIComponent(contentData.emailBody)}`;
                break;
            default:
                break;
        }

        const hasFrame = options.frameStyle !== 'none';
        
        const updateOptions = {
            width: hasFrame ? 220 : 280,
            height: hasFrame ? 220 : 280,
            margin: hasFrame ? 10 : 0,
            data: qrData,
            dotsOptions: {
                type: options.dotsType,
                color: options.dotsColor,
                ...(options.gradientEnabled ? {
                    gradient: {
                        type: "linear",
                        rotation: 45,
                        colorStops: [
                            { offset: 0, color: options.dotsColor },
                            { offset: 1, color: options.gradientColor }
                        ]
                    }
                } : {})
            },
            backgroundOptions: {
                color: options.bgTransparent ? "transparent" : options.bgColor,
            },
            cornersSquareOptions: {
                type: options.eyeBorderType,
                color: options.eyeBorderColor,
            },
            cornersDotOptions: {
                type: options.eyeCenterType,
                color: options.eyeCenterColor,
            },
            image: options.logo || "",
            imageOptions: {
                crossOrigin: "anonymous",
                margin: 4,
                imageSize: options.logoSize,
                hideBackgroundDots: options.excavate
            }
        };
        
        qrCodeInstanceRef.current.update(updateOptions);

        setTimeout(() => {
            checkScanability();
        }, 250);

    }, [options, contentType, contentData]);

    const updateContent = (key, value) => {
        setContentData(prev => ({ ...prev, [key]: value }));
    };

    const handleDownload = async () => {
        if (!qrCodeInstanceRef.current) return;
        
        const fileName = `custom-qrcode.${fmt.toLowerCase()}`;
        
        if (options.frameStyle !== 'none') {
            if (!frameContainerRef.current) return;
            try {
                const scale = 3;
                const node = frameContainerRef.current;
                const param = {
                    height: node.offsetHeight * scale,
                    width: node.offsetWidth * scale,
                    style: {
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        width: node.offsetWidth + 'px',
                        height: node.offsetHeight + 'px'
                    },
                    pixelRatio: 1,
                    cacheBust: true
                };

                let dataUrl;
                if (fmt === "PNG") dataUrl = await toPng(node, param);
                else if (fmt === "JPEG") dataUrl = await toJpeg(node, param);
                else if (fmt === "SVG") dataUrl = await toSvg(node, param);

                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            } catch (e) {
                console.error("Failed to export custom frame", e);
            }
            return;
        }

        try {
            if (fmt === 'PNG' && options.bgTransparent) {
                const svgBlob = await qrCodeInstanceRef.current.getRawData('svg');

                if (!svgBlob) {
                    throw new Error('Failed to export QR code.');
                }

                const pngBlob = await svgBlobToPngBlob(svgBlob);
                downloadBlob(pngBlob, fileName);
                return;
            }

            const rawBlob = await qrCodeInstanceRef.current.getRawData(fmt.toLowerCase());

            if (!rawBlob) {
                throw new Error('Failed to export QR code.');
            }

            downloadBlob(rawBlob, fileName);
        } catch (e) {
            console.error("Failed to export QR code", e);
        }
    };

    const updateOption = (key, value) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                updateOption('logo', event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const renderPreviewFrame = () => {
        const hasFrame = options.frameStyle !== 'none';
        const qrPreviewTransparent = options.frameStyle === 'none' && options.bgTransparent;
        
        let containerClasses = "relative flex flex-col items-center justify-center transition-all ";
        let containerStyle = {};
        let qrWrapperClasses = "";
        let qrWrapperStyle = {};

        if (options.frameStyle === 'bottom') {
            containerClasses += "bg-white rounded-[24px] shadow-sm overflow-hidden border-[8px]";
            containerStyle.borderColor = options.frameColor;
            qrWrapperClasses = "p-4 bg-white";
        } else if (options.frameStyle === 'badge') {
            containerClasses += "pb-6";
            qrWrapperClasses = "p-4 bg-white rounded-[24px] shadow-sm border-[8px] mb-2";
            qrWrapperStyle.borderColor = options.frameColor;
        } else if (options.frameStyle === 'focus') {
            containerClasses += "p-6 bg-white rounded-[32px] shadow-sm border-4";
            containerStyle.borderColor = options.frameColor;
            qrWrapperClasses = "p-2 z-10";
        } else if (options.frameStyle === 'phone') {
            containerClasses += "p-4 pt-10 pb-6 bg-white rounded-[36px] shadow-sm border-8 border-stone-800";
            qrWrapperClasses = "z-10";
        } else if (options.frameStyle === 'clipboard') {
            containerClasses += "p-5 pt-8 bg-white rounded-lg shadow-sm border-2 border-stone-300";
            qrWrapperClasses = "z-10";
        } else if (options.frameStyle === 'polaroid') {
            containerClasses += "p-4 pb-14 bg-white shadow-md border border-stone-200 relative";
            qrWrapperClasses = "z-10";
        } else if (options.frameStyle === 'browser') {
            containerClasses += "bg-stone-50 rounded-xl shadow-sm border-2 overflow-hidden flex flex-col";
            containerStyle.borderColor = options.frameColor;
            qrWrapperClasses = "p-5 bg-white z-10";
        } else {
            containerClasses += `p-2 ${qrPreviewTransparent ? 'bg-transparent' : 'bg-white'} rounded-xl shadow-sm border border-stone-100`;
        }

        return (
            <div ref={frameContainerRef} className={containerClasses} style={containerStyle}>
                {options.frameStyle === 'focus' && (
                    <>
                        <div className="absolute top-2 left-2 w-12 h-12 border-t-[8px] border-l-[8px] rounded-tl-[24px]" style={{ borderColor: options.frameColor }}></div>
                        <div className="absolute top-2 right-2 w-12 h-12 border-t-[8px] border-r-[8px] rounded-tr-[24px]" style={{ borderColor: options.frameColor }}></div>
                        <div className="absolute bottom-2 left-2 w-12 h-12 border-b-[8px] border-l-[8px] rounded-bl-[24px]" style={{ borderColor: options.frameColor }}></div>
                        <div className="absolute bottom-2 right-2 w-12 h-12 border-b-[8px] border-r-[8px] rounded-br-[24px]" style={{ borderColor: options.frameColor }}></div>
                    </>
                )}
                {options.frameStyle === 'phone' && (
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-stone-800 rounded-b-2xl flex items-center justify-center z-20">
                         <div className="w-10 h-1.5 bg-stone-600 rounded-full"></div>
                     </div>
                )}
                {options.frameStyle === 'clipboard' && (
                     <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-8 bg-stone-200 rounded-t-lg border-2 border-stone-400 flex items-center justify-center shadow-inner z-20">
                         <div className="w-12 h-2 bg-stone-400 rounded-full"></div>
                     </div>
                )}
                {options.frameStyle === 'browser' && (
                    <div className="w-full h-8 flex items-center px-3 gap-1.5 z-20" style={{ backgroundColor: options.frameColor }}>
                        <div className="w-3 h-3 rounded-full bg-white/60"></div>
                        <div className="w-3 h-3 rounded-full bg-white/60"></div>
                        <div className="w-3 h-3 rounded-full bg-white/60"></div>
                    </div>
                )}

                <div className={qrWrapperClasses} style={qrWrapperStyle}>
                    <div 
                        ref={qrRef} 
                        className={`rounded-lg ${options.frameStyle === 'none' && !qrPreviewTransparent ? 'bg-white' : ''}`} 
                        style={{ width: hasFrame ? 220 : 280, height: hasFrame ? 220 : 280 }}
                    ></div>
                </div>

                {options.frameStyle === 'bottom' && (
                    <div className="w-full text-center py-3 font-bold tracking-widest text-lg mt-4" style={{ backgroundColor: options.frameColor, color: options.frameTextColor }}>
                        {options.frameText}
                    </div>
                )}
                {options.frameStyle === 'badge' && (
                    <div className="absolute bottom-0 px-8 py-2.5 rounded-full font-bold tracking-widest text-lg shadow-md border-4 border-white z-20" style={{ backgroundColor: options.frameColor, color: options.frameTextColor }}>
                        {options.frameText}
                    </div>
                )}
                {(options.frameStyle === 'focus' || options.frameStyle === 'phone' || options.frameStyle === 'clipboard') && (
                    <div className={`text-center font-bold mt-2 tracking-widest text-lg z-10 ${options.frameStyle === 'phone' ? 'mb-2' : ''}`} style={{ color: options.frameTextColor }}>
                        {options.frameText}
                    </div>
                )}
                {options.frameStyle === 'polaroid' && (
                    <div className="absolute bottom-4 left-0 w-full text-center font-bold tracking-widest text-lg z-20" style={{ color: options.frameTextColor }}>
                        {options.frameText}
                    </div>
                )}
                {options.frameStyle === 'browser' && (
                    <div className="w-full text-center py-3 font-bold tracking-widest text-lg bg-stone-100 border-t border-stone-200 z-10" style={{ color: options.frameTextColor }}>
                        {options.frameText}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Layout>
            <main className="max-w-7xl mx-auto p-4 sm:p-8">
                <div className="max-w-6xl mx-auto px-4">
                    <nav className="mb-6">
                        <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Home</span>
                        </Link>
                    </nav>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        {/* Customization Panel */}
                        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden lg:col-span-8">
                            
                            {/* Dynamic Content Panel */}
                            <div className="p-6 border-b border-stone-100">
                                <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                    Content
                                </h2>

                                {/* Content Type Selector */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {[
                                        { id: 'link', icon: <LinkIcon className="w-4 h-4"/>, label: 'Link' },
                                        { id: 'text', icon: <Type className="w-4 h-4"/>, label: 'Text' },
                                        { id: 'wifi', icon: <Wifi className="w-4 h-4"/>, label: 'Wi-Fi' },
                                        { id: 'phone', icon: <Phone className="w-4 h-4"/>, label: 'Phone' },
                                        { id: 'email', icon: <Mail className="w-4 h-4"/>, label: 'Email' }
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setContentType(type.id)}
                                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${contentType === type.id ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                                        >
                                            {type.icon} {type.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Dynamic Inputs */}
                                <div className="space-y-4">
                                    {contentType === 'link' && (
                                        <input type="text" placeholder="https://example.com" value={contentData.url} onChange={(e) => updateContent('url', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                    )}
                                    {contentType === 'text' && (
                                        <textarea placeholder="Enter your text here..." value={contentData.text} onChange={(e) => updateContent('text', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors min-h-[100px]" />
                                    )}
                                    {contentType === 'wifi' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input type="text" placeholder="Network Name (SSID)" value={contentData.wifiSsid} onChange={(e) => updateContent('wifiSsid', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors md:col-span-2" />
                                            <input type="text" placeholder="Password" value={contentData.wifiPassword} onChange={(e) => updateContent('wifiPassword', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                            <select value={contentData.wifiEncryption} onChange={(e) => updateContent('wifiEncryption', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none">
                                                <option value="WPA">WPA/WPA2</option>
                                                <option value="WEP">WEP</option>
                                                <option value="nopass">None</option>
                                            </select>
                                        </div>
                                    )}
                                    {contentType === 'phone' && (
                                        <input type="tel" placeholder="Phone Number" value={contentData.phone} onChange={(e) => updateContent('phone', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                    )}
                                    {contentType === 'email' && (
                                        <div className="space-y-4">
                                            <input type="email" placeholder="Email Address" value={contentData.email} onChange={(e) => updateContent('email', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                            <input type="text" placeholder="Subject" value={contentData.emailSubject} onChange={(e) => updateContent('emailSubject', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                            <textarea placeholder="Message Body" value={contentData.emailBody} onChange={(e) => updateContent('emailBody', e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors min-h-[100px]" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6">
                                <h2 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                                    Design
                                </h2>

                                {/* Tabs */}
                                <div className="flex border-b border-stone-200 mb-6 overflow-x-auto">
                                    {['frame', 'shape', 'logo'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="min-h-[300px]">
                                    {activeTab === 'frame' && (
                                        <div className="space-y-6">
                                            {/* Horizontal Frame Selector */}
                                            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                                                <div className="flex gap-4 min-w-max px-2">
                                                    {/* None Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'none')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 ${options.frameStyle === 'none' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-stone-50 hover:border-stone-300'}`}
                                                    >
                                                        <X className="w-10 h-10 text-stone-400" />
                                                    </button>

                                                    {/* Bottom Tag Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'bottom')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 ${options.frameStyle === 'bottom' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-14 h-16 border-2 border-stone-800 rounded flex flex-col overflow-hidden">
                                                            <div className="flex-1 bg-white p-1">
                                                                <div className="w-full h-full border border-stone-300 border-dashed rounded-sm"></div>
                                                            </div>
                                                            <div className="h-4 bg-stone-800 flex items-center justify-center">
                                                                <div className="w-8 h-1 bg-white/50 rounded-full"></div>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {/* Badge Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'badge')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 relative ${options.frameStyle === 'badge' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-14 h-14 border-2 border-stone-800 rounded flex items-center justify-center bg-white">
                                                            <div className="w-10 h-10 border border-stone-300 border-dashed rounded-sm"></div>
                                                        </div>
                                                        <div className="absolute bottom-[18px] w-12 h-4 bg-stone-800 rounded-full flex items-center justify-center border-2 border-white">
                                                            <div className="w-6 h-1 bg-white/50 rounded-full"></div>
                                                        </div>
                                                    </button>
                                                    
                                                    {/* Focus Bracket Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'focus')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 relative ${options.frameStyle === 'focus' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-14 h-16 border-2 border-transparent relative flex flex-col justify-between items-center pb-1">
                                                            <div className="w-12 h-12 border border-stone-300 border-dashed rounded-sm absolute top-1"></div>
                                                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-stone-800 rounded-tl"></div>
                                                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-stone-800 rounded-tr"></div>
                                                            <div className="absolute bottom-4 left-0 w-3 h-3 border-b-2 border-l-2 border-stone-800 rounded-bl"></div>
                                                            <div className="absolute bottom-4 right-0 w-3 h-3 border-b-2 border-r-2 border-stone-800 rounded-br"></div>
                                                            <div className="h-2 w-8 bg-stone-800 rounded-sm mt-auto mb-0.5 opacity-80"></div>
                                                        </div>
                                                    </button>

                                                    {/* Phone Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'phone')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 ${options.frameStyle === 'phone' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-12 h-16 border-[3px] border-stone-800 rounded-md relative flex flex-col items-center pt-2">
                                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-1 bg-stone-800 rounded-b-sm"></div>
                                                            <div className="w-8 h-8 border border-stone-300 border-dashed rounded-sm mt-1"></div>
                                                            <div className="h-1 w-6 bg-stone-800 rounded-sm mt-auto mb-1"></div>
                                                        </div>
                                                    </button>

                                                    {/* Clipboard Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'clipboard')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 relative ${options.frameStyle === 'clipboard' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-14 h-16 border-2 border-stone-300 rounded-[4px] relative flex flex-col items-center bg-stone-50">
                                                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 border-2 border-stone-400 bg-stone-200 rounded-t-sm"></div>
                                                            <div className="w-10 h-10 border border-stone-300 border-dashed rounded-sm mt-3 bg-white"></div>
                                                            <div className="h-1.5 w-6 bg-stone-800 rounded-sm mt-auto mb-1 opacity-80"></div>
                                                        </div>
                                                    </button>

                                                    {/* Polaroid Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'polaroid')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 ${options.frameStyle === 'polaroid' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-14 h-16 bg-white border border-stone-300 shadow-sm rounded-sm p-1.5 pb-4 flex flex-col">
                                                            <div className="w-full flex-1 border border-stone-300 border-dashed"></div>
                                                        </div>
                                                    </button>

                                                    {/* Browser Option */}
                                                    <button 
                                                        onClick={() => updateOption('frameStyle', 'browser')}
                                                        className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all shrink-0 ${options.frameStyle === 'browser' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                                                    >
                                                        <div className="w-16 h-14 border-2 border-stone-800 rounded-md overflow-hidden flex flex-col bg-white">
                                                            <div className="h-3 w-full bg-stone-800 flex items-center px-1 gap-0.5">
                                                                <div className="w-1 h-1 rounded-full bg-white/60"></div>
                                                                <div className="w-1 h-1 rounded-full bg-white/60"></div>
                                                                <div className="w-1 h-1 rounded-full bg-white/60"></div>
                                                            </div>
                                                            <div className="flex-1 flex items-center justify-center p-1.5">
                                                                <div className="w-full h-full border border-stone-300 border-dashed"></div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Frame Customization (Text & Color) */}
                                            {options.frameStyle !== 'none' && (
                                                <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                                                    <div>
                                                        <label className="text-sm font-medium text-stone-700 block mb-2">Frame Color</label>
                                                        <div className="flex items-center gap-3 max-w-[240px]">
                                                            <input type="color" value={options.frameColor} onChange={(e) => updateOption('frameColor', e.target.value)} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer" />
                                                            <input type="text" value={options.frameColor} onChange={(e) => updateOption('frameColor', e.target.value)} className="flex-1 min-w-0 p-2.5 border border-stone-200 rounded-xl text-sm uppercase focus:border-indigo-500 focus:outline-none" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-sm font-medium text-stone-700 block mb-2">Frame Text</label>
                                                            <input 
                                                                type="text" 
                                                                value={options.frameText} 
                                                                onChange={(e) => updateOption('frameText', e.target.value)}
                                                                className="w-full p-2.5 border border-stone-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
                                                                placeholder="e.g., SCAN ME"
                                                                maxLength={15}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-medium text-stone-700 block mb-2">Text Color</label>
                                                            <div className="flex items-center gap-3">
                                                                <input type="color" value={options.frameTextColor} onChange={(e) => updateOption('frameTextColor', e.target.value)} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer" />
                                                                <input type="text" value={options.frameTextColor} onChange={(e) => updateOption('frameTextColor', e.target.value)} className="flex-1 min-w-0 p-2.5 border border-stone-200 rounded-xl text-sm uppercase focus:border-indigo-500 focus:outline-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeTab === 'shape' && (
                                        <div className="space-y-8">
                                            {/* Shape Style */}
                                            <div>
                                                <label className="text-sm font-medium text-stone-700 block mb-3">Shape style</label>
                                                <div className="flex flex-wrap gap-3 mb-4">
                                                    {patternOptions.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => updateOption('dotsType', opt.value)}
                                                            title={opt.label}
                                                            className={`flex items-center justify-center w-14 h-14 border-2 rounded-xl transition-all shrink-0 ${options.dotsType === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Background color</label>
                                                        <div className="flex items-center gap-3">
                                                            <input type="text" value={options.bgColor} onChange={(e) => updateOption('bgColor', e.target.value)} disabled={options.bgTransparent} className="flex-1 p-2.5 border border-stone-200 rounded-lg text-sm uppercase focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
                                                            <input type="color" value={options.bgColor} onChange={(e) => updateOption('bgColor', e.target.value)} disabled={options.bgTransparent} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer disabled:opacity-50" />
                                                        </div>
                                                        <label className="flex items-center gap-2 mt-3 text-sm text-stone-600 cursor-pointer">
                                                            <input type="checkbox" checked={options.bgTransparent} onChange={(e) => updateOption('bgTransparent', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                                            Transparent background
                                                        </label>
                                                        <p className="mt-2 text-[11px] text-stone-500">
                                                            PNG and SVG exports preserve transparency.
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Shape color</label>
                                                        <div className="space-y-3">
                                                            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                                                                <input type="checkbox" checked={options.gradientEnabled} onChange={(e) => updateOption('gradientEnabled', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                                                Enable Color Gradient
                                                            </label>
                                                            
                                                            {!options.gradientEnabled ? (
                                                                <div className="flex items-center gap-3">
                                                                    <input type="text" value={options.dotsColor} onChange={(e) => updateOption('dotsColor', e.target.value)} className="flex-1 min-w-0 p-2.5 border border-stone-200 rounded-lg text-sm uppercase focus:outline-none focus:border-indigo-500" />
                                                                    <input type="color" value={options.dotsColor} onChange={(e) => updateOption('dotsColor', e.target.value)} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer" />
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3 p-3 bg-stone-100/50 rounded-xl border border-stone-200">
                                                                    {/* Gradient Visual Preview Bar */}
                                                                    <div 
                                                                        className="h-3 w-full rounded-full shadow-inner border border-white"
                                                                        style={{ background: `linear-gradient(45deg, ${options.dotsColor}, ${options.gradientColor})` }}
                                                                    />
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                        <div>
                                                                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Start Color</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <input type="color" value={options.dotsColor} onChange={(e) => updateOption('dotsColor', e.target.value)} className="w-8 h-8 shrink-0 p-1 rounded-md border border-stone-200 bg-white cursor-pointer" />
                                                                                <input type="text" value={options.dotsColor} onChange={(e) => updateOption('dotsColor', e.target.value)} className="flex-1 min-w-0 p-1.5 border border-stone-200 rounded-md text-xs uppercase focus:outline-none focus:border-indigo-500" />
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">End Color</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <input type="color" value={options.gradientColor} onChange={(e) => updateOption('gradientColor', e.target.value)} className="w-8 h-8 shrink-0 p-1 rounded-md border border-stone-200 bg-white cursor-pointer" />
                                                                                <input type="text" value={options.gradientColor} onChange={(e) => updateOption('gradientColor', e.target.value)} className="flex-1 min-w-0 p-1.5 border border-stone-200 rounded-md text-xs uppercase focus:outline-none focus:border-indigo-500" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-stone-200 w-full my-6"></div>
                                            
                                            {/* Border Style */}
                                            <div>
                                                <label className="text-sm font-medium text-stone-700 block mb-3">Border style</label>
                                                <div className="flex flex-wrap gap-3 mb-4">
                                                    {eyeBorderOptions.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => updateOption('eyeBorderType', opt.value)}
                                                            title={opt.label}
                                                            className={`flex items-center justify-center w-14 h-14 border-2 rounded-xl transition-all shrink-0 ${options.eyeBorderType === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Border color</label>
                                                    <div className="flex items-center gap-3 max-w-[240px]">
                                                        <input type="text" value={options.eyeBorderColor} onChange={(e) => updateOption('eyeBorderColor', e.target.value)} className="flex-1 p-2.5 border border-stone-200 rounded-lg text-sm uppercase focus:outline-none focus:border-indigo-500" />
                                                        <input type="color" value={options.eyeBorderColor} onChange={(e) => updateOption('eyeBorderColor', e.target.value)} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-stone-200 w-full my-6"></div>

                                            {/* Center Style */}
                                            <div>
                                                <label className="text-sm font-medium text-stone-700 block mb-3">Center style</label>
                                                <div className="flex flex-wrap gap-3 mb-4">
                                                    {eyeCenterOptions.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => updateOption('eyeCenterType', opt.value)}
                                                            title={opt.label}
                                                            className={`flex items-center justify-center w-14 h-14 border-2 rounded-xl transition-all shrink-0 ${options.eyeCenterType === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">Center color</label>
                                                    <div className="flex items-center gap-3 max-w-[240px]">
                                                        <input type="text" value={options.eyeCenterColor} onChange={(e) => updateOption('eyeCenterColor', e.target.value)} className="flex-1 p-2.5 border border-stone-200 rounded-lg text-sm uppercase focus:outline-none focus:border-indigo-500" />
                                                        <input type="color" value={options.eyeCenterColor} onChange={(e) => updateOption('eyeCenterColor', e.target.value)} className="w-10 h-10 shrink-0 p-1 rounded-lg border border-stone-200 bg-white cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'logo' && (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-sm font-medium text-stone-700 block mb-3">Upload Logo</label>
                                                <div className="flex items-center justify-center w-full">
                                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors">
                                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                            <Upload className="w-8 h-8 mb-2 text-stone-500" />
                                                            <p className="text-sm text-stone-500">Click to upload or drag and drop</p>
                                                        </div>
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                                    </label>
                                                </div>
                                                {options.logo && (
                                                     <div className="mt-4 flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                                                        <div className="flex items-center gap-3">
                                                             <img src={options.logo} alt="Logo preview" className="w-8 h-8 object-contain" />
                                                             <span className="text-sm text-stone-600">Logo applied</span>
                                                        </div>
                                                        <button onClick={() => updateOption('logo', null)} className="text-red-500 hover:text-red-700 p-1">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                     </div>
                                                )}
                                            </div>
                                            
                                            {options.logo && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="flex justify-between text-sm font-medium text-stone-700 mb-2">
                                                            <span>Logo Size</span>
                                                            <span>{Math.round(options.logoSize * 100)}%</span>
                                                        </label>
                                                        <input 
                                                            type="range" 
                                                            min="0.1" max="0.5" step="0.05" 
                                                            value={options.logoSize} 
                                                            onChange={(e) => updateOption('logoSize', parseFloat(e.target.value))}
                                                            className="w-full accent-indigo-600"
                                                        />
                                                    </div>
                                                    <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                                                        <input type="checkbox" checked={options.excavate} onChange={(e) => updateOption('excavate', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                                        Remove background behind Logo (Excavate)
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Preview Panel Column Container (Option 2) */}
                        <div className="lg:col-span-4">
                            <div className="bg-white rounded-2xl p-6 border border-stone-200 sticky top-32">
                                 <h2 className="text-lg font-semibold text-stone-800 mb-6 flex items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                                    Preview
                                </h2>
                                
                                <div className="flex flex-col items-center">
                                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 mb-4 w-full flex justify-center items-center min-h-[350px]">
                                        {/* HTML/CSS Based Frame Preview */}
                                        {renderPreviewFrame()}
                                    </div>

                                    {/* Scan-ability Indicator */}
                                    <div className={`w-full flex items-center gap-2 p-3 rounded-xl text-sm font-medium mb-6 ${isScannable ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                        {isScannable ? (
                                            <>
                                                <ShieldCheck className="w-5 h-5" />
                                                High Scanability
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="w-5 h-5" />
                                                Low Contrast - Might fail to scan
                                            </>
                                        )}
                                    </div>

                                    <div className="w-full space-y-1.5 mb-4">
                                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                                            Download Format
                                        </label>
                                        <select
                                            value={fmt}
                                            onChange={(e) => setFmt(e.target.value)}
                                            className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 bg-white focus:outline-none focus:border-indigo-500"
                                        >
                                            {formats.map((f) => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleDownload}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl p-3.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download QR Code
                                    </button>
                                </div>
                            </div>
                        </div>      
                    </div>
                </div>
            </main>
        </Layout>
    );
}
