export type CourseId =
  | 'olevel'
  | 'ccc'
  | 'msexcel'
  | 'msword'
  | 'mspowerpoint'
  | 'html'
  | 'css'
  | 'javascript'
  | 'python';

export type ExamLanguage = 'en' | 'hi' | 'bilingual';

export interface ChapterInfo {
  id: string;
  number: number;
  title: string;
  titleHi: string;
  description: string;
  topics: string[];
}

export interface ModuleInfo {
  id: string;
  code: string;
  title: string;
  titleHi: string;
  description: string;
  syllabusSummary: string[];
  chapters: ChapterInfo[];
}

export interface CourseInfo {
  id: CourseId;
  name: string;
  shortName: string;
  category: 'NIELIT Certification' | 'Office Productivity' | 'Web & Programming';
  description: string;
  practiceModeLabel: string;
  hasModules: boolean;
  hasChapters: boolean;
  syllabusOverview: string[];
  modules?: ModuleInfo[];
  chapters?: ChapterInfo[];
}

export const COURSES: CourseInfo[] = [
  {
    id: 'olevel',
    name: "O'Level",
    shortName: "O'Level (NIELIT R5.1)",
    category: 'NIELIT Certification',
    description:
      'Complete NIELIT O\'Level (IT) R5.1 preparation across all four official modules (M1-R5 to M4-R5) with chapter-wise bilingual CBT practice.',
    practiceModeLabel: 'Module & Chapter-wise CBT Practice',
    hasModules: true,
    hasChapters: true,
    syllabusOverview: [
      'M1-R5: Information Technology Tools and Network Basics',
      'M2-R5: Web Designing & Publishing',
      'M3-R5: Programming and Problem Solving Through Python',
      'M4-R5: Internet of Things and its Applications',
    ],
    modules: [
      {
        id: 'M1',
        code: 'M1-R5',
        title: 'M1 — Information Technology',
        titleHi: 'M1 — सूचना प्रौद्योगिकी टूल्स और नेटवर्क बेसिक्स',
        description:
          'Covers computer appreciation, operating systems (Windows & Linux), LibreOffice Writer, Calc, Impress, computer networks, internet protocols, e-Governance, digital financial tools, and cybersecurity.',
        syllabusSummary: [
          'Computer Hardware, Software, Memory Hierarchy & Number Systems',
          'Operating Systems: Desktop, File Management, Linux Commands & Settings',
          'LibreOffice Writer, Calc (Spreadsheets) & Impress (Presentations)',
          'LAN/WAN Topologies, OSI/TCP-IP Models, Email & e-Governance Services',
          'Digital Financial Tools (UPI, AEPS, USSD, e-Wallet) & Cyber Security Basics',
        ],
        chapters: [
          {
            id: 'm1-ch1',
            number: 1,
            title: 'Introduction to Computer',
            titleHi: 'कंप्यूटर का परिचय',
            description:
              'Evolution of computers, characteristics, CPU components (ALU, CU, Registers), input/output devices, primary and secondary memory, hardware vs software, and binary/hexadecimal number systems.',
            topics: ['CPU & Architecture', 'Input/Output Devices', 'RAM, ROM, Cache & Storage', 'System vs Application Software'],
          },
          {
            id: 'm1-ch2',
            number: 2,
            title: 'Introduction to Operating System',
            titleHi: 'ऑपरेटिंग सिस्टम का परिचय',
            description:
              'Desktop & mobile operating systems, user interface, task bar, file and directory management, Linux kernel/shell concepts, and file permissions.',
            topics: ['OS Functions & Types', 'Windows & Linux Desktop', 'File & Folder Operations', 'Basic Linux Commands'],
          },
          {
            id: 'm1-ch3',
            number: 3,
            title: 'Word Processing (LibreOffice Writer)',
            titleHi: 'वर्ड प्रोसेसिंग (लिब्रे ऑफिस राइटर)',
            description:
              'Document creation, text formatting, paragraph alignment, styles, tables, mail merge, headers/footers, track changes, and keyboard shortcuts in LibreOffice Writer.',
            topics: ['Text & Paragraph Formatting', 'Tables & Mail Merge', 'Headers, Footers & Page Setup', 'LibreOffice Writer Shortcuts'],
          },
          {
            id: 'm1-ch4',
            number: 4,
            title: 'Spreadsheet (LibreOffice Calc)',
            titleHi: 'स्प्रेडशीट (लिब्रे ऑफिस कैल्क)',
            description:
              'Rows, columns, cell addressing (relative, absolute, mixed), formulas, logical/mathematical/text functions, charts, sorting, and filtering in LibreOffice Calc.',
            topics: ['Cell Referencing ($A$1)', 'Calc Formulas & Functions', 'Charts & Data Visualization', 'Sorting, Filtering & Pivot Tables'],
          },
          {
            id: 'm1-ch5',
            number: 5,
            title: 'Presentation (LibreOffice Impress)',
            titleHi: 'प्रेजेंटेशन (लिब्रे ऑफिस इम्प्रेस)',
            description:
              'Slide creation, master slides, slide layouts, custom animations, slide transitions, inserting multimedia tables/objects, and presentation view shortcuts.',
            topics: ['Slide Master & Views', 'Animations & Transitions', 'Multimedia & Tables in Slides', 'Impress Shortcuts & Export'],
          },
          {
            id: 'm1-ch6',
            number: 6,
            title: 'Introduction to Internet and WWW',
            titleHi: 'इंटरनेट और डब्ल्यूडब्ल्यूडब्ल्यू का परिचय',
            description:
              'LAN, MAN, WAN, network topologies (Star, Bus, Ring, Mesh), OSI 7-layer model, TCP/IP, IPv4 vs IPv6, MAC address, DNS, URL, web browsers, and search engines.',
            topics: ['Network Topologies & Devices', 'OSI & TCP/IP Protocols', 'IPv4, IPv6 & MAC Addressing', 'Web Browsers & Search Engines'],
          },
          {
            id: 'm1-ch7',
            number: 7,
            title: 'E-mail, Social Networking and e-Governance Services',
            titleHi: 'ई-मेल, सोशल नेटवर्किंग और ई-गवर्नेंस सेवाएं',
            description:
              'Email structure (To, CC, BCC), SMTP, POP3, IMAP protocols, netiquette, social media platforms, UMANG app, DigiLocker, Railway reservation, and Aadhaar services.',
            topics: ['Email Protocols (SMTP, IMAP, POP3)', 'Social Media & Instant Messaging', 'UMANG, DigiLocker & ORS', 'e-Governance Models (G2C, G2B)'],
          },
          {
            id: 'm1-ch8',
            number: 8,
            title: 'Digital Financial Tools and Applications',
            titleHi: 'डिजिटल वित्तीय उपकरण और अनुप्रयोग',
            description:
              'OTP, QR Code, UPI, AEPS, USSD (*99#), credit/debit cards, e-Wallets, POS machines, Internet Banking, NEFT, RTGS, and IMPS.',
            topics: ['UPI, AEPS & USSD (*99#)', 'NEFT, RTGS & IMPS', 'POS, RuPay & e-Wallets', 'Safe Digital Banking Practices'],
          },
          {
            id: 'm1-ch9',
            number: 9,
            title: 'Overview of FutureSkills and Cyber Security',
            titleHi: 'फ्यूचरस्किल्स और साइबर सुरक्षा का अवलोकन',
            description:
              'IoT, Big Data Analytics, Cloud Computing (IaaS, PaaS, SaaS), Virtual Reality, Artificial Intelligence, Blockchain, 3D Printing, malware threats, phishing, and encryption.',
            topics: ['Cloud Computing, AI & Blockchain', 'Big Data, VR & 3D Printing', 'Malware, Phishing & Firewalls', 'PC & Smartphone Security'],
          },
        ],
      },
      {
        id: 'M2',
        code: 'M2-R5',
        title: 'M2 — Web Designing & Publishing',
        titleHi: 'M2 — वेब डिजाइनिंग और पब्लिशिंग',
        description:
          'Covers web design fundamentals, HTML5 markup, CSS3 layouts, W3.CSS framework, client-side JavaScript, AngularJS basics, photo editing, and web publishing.',
        syllabusSummary: [
          'Web Architecture, HTTP/HTTPS, Client-Server Model & Code Editors',
          'HTML5 Elements, Semantic Tags, Forms, Tables, Frames & Media',
          'CSS3 Selectors, Box Model, Positioning, Transitions & Responsive Layouts',
          'W3.CSS Framework Classes: Containers, Panels, Grids, Tables & Navigation',
          'JavaScript DOM, Events, Form Validation, AngularJS & Web Publishing',
        ],
        chapters: [
          {
            id: 'm2-ch1',
            number: 1,
            title: 'Introduction to Web Design and Editors',
            titleHi: 'वेब डिजाइन और एडिटर्स का परिचय',
            description:
              'Static vs dynamic websites, front-end vs back-end, HTTP/HTTPS protocols, URL components, portals, and HTML editors (Notepad++, VS Code, Sublime Text).',
            topics: ['Static vs Dynamic Web Pages', 'HTTP Request/Response Cycle', 'DOM & Web Standards', 'Code Editors & IDE Features'],
          },
          {
            id: 'm2-ch2',
            number: 2,
            title: 'HTML Basics and HTML5 Elements',
            titleHi: 'HTML बेसिक्स और HTML5 तत्व',
            description:
              'HTML document structure, headings, lists, hyperlinks, images, tables (rowspan/colspan), HTML5 forms, input types, audio, video, canvas, and semantic tags.',
            topics: ['Lists, Links & Tables', 'HTML5 Form Controls & Attributes', 'Audio, Video & Canvas Tags', 'Semantic HTML5 Elements'],
          },
          {
            id: 'm2-ch3',
            number: 3,
            title: 'Cascading Style Sheets (CSS)',
            titleHi: 'कैस्केडिंग स्टाइल शीट्स (CSS)',
            description:
              'Inline, internal, and external CSS, class/ID/attribute selectors, pseudo-classes, box model, positioning, flexbox, media queries, and CSS3 properties.',
            topics: ['Selectors & Specificity', 'CSS Box Model & Display', 'Positioning, Float & Z-Index', 'CSS3 Shadows, Gradients & Transitions'],
          },
          {
            id: 'm2-ch4',
            number: 4,
            title: 'CSS Framework (W3.CSS)',
            titleHi: 'सीएसएस फ्रेमवर्क (W3.CSS)',
            description:
              'W3.CSS classes including w3-container, w3-panel, w3-card, w3-row, 12-column responsive grid (s/m/l), w3-table, w3-button, w3-bar, and color classes.',
            topics: ['w3-container, w3-panel & w3-card', 'W3.CSS 12-Column Grid System', 'W3.CSS Tables, Lists & Buttons', 'W3.CSS Navigation & Modals'],
          },
          {
            id: 'm2-ch5',
            number: 5,
            title: 'JavaScript and AngularJS',
            titleHi: 'जावास्क्रिप्ट और एंगुलरजेएस',
            description:
              'JavaScript variables, operators, functions, dialog boxes (alert, confirm, prompt), DOM methods, events, form validation, and AngularJS directives (ng-app, ng-model, ng-bind, ng-repeat).',
            topics: ['JS Variables, Loops & Functions', 'DOM Manipulation & Events', 'Dialog Boxes & Form Validation', 'AngularJS Directives & Expressions'],
          },
          {
            id: 'm2-ch6',
            number: 6,
            title: 'Photo Editor, Web Publishing and Browsing',
            titleHi: 'फोटो एडिटर, वेब पब्लिशिंग और ब्राउजिंग',
            description:
              'Image formats (JPEG, PNG, GIF, SVG, WebP), image selection/cropping, layers, filters, web hosting, DNS registration, FTP protocols, and SEO fundamentals.',
            topics: ['Raster vs Vector Image Formats', 'Layers, Filters & Color Modes', 'Web Hosting, Domain & DNS', 'FTP Publishing & Search Engine Indexing'],
          },
        ],
      },
      {
        id: 'M3',
        code: 'M3-R5',
        title: 'M3 — Programming and Problem Solving Through Python',
        titleHi: 'M3 — पायथन के माध्यम से प्रोग्रामिंग और समस्या समाधान',
        description:
          'Covers algorithms, flowcharts, Python syntax, control structures, sequence data types (List, Tuple, Dictionary, Set), functions, recursion, file handling, and NumPy.',
        syllabusSummary: [
          'Algorithms, Flowcharts, Pseudocode & Problem Solving Methodologies',
          'Python Tokens, Data Types, Operators, Precedence & Type Casting',
          'Conditional Statements (if-elif-else) and Iterative Loops (for, while)',
          'Strings, Lists, Tuples, Sets & Dictionaries with Built-in Methods',
          'User-Defined Functions, Recursion, Modules, File I/O & NumPy Arrays',
        ],
        chapters: [
          {
            id: 'm3-ch1',
            number: 1,
            title: 'Introduction to Programming, Algorithm and Flowcharts',
            titleHi: 'प्रोग्रामिंग, एल्गोरिदम और फ्लोचार्ट का परिचय',
            description:
              'Concept of problem solving, characteristics of algorithms, flowchart symbols (oval, parallelogram, diamond, rectangle), pseudocode, compilers vs interpreters.',
            topics: ['Algorithm Characteristics', 'Flowchart Symbols & Logic', 'Pseudocode Representation', 'Compiler, Interpreter & Assembler'],
          },
          {
            id: 'm3-ch2',
            number: 2,
            title: 'Introduction to Python, Operators and Expressions',
            titleHi: 'पायथन का परिचय, ऑपरेटर्स और एक्सप्रेशंस',
            description:
              'Python history, interactive vs script mode, identifiers, keywords, mutable vs immutable types, arithmetic/relational/logical/bitwise/membership/identity operators.',
            topics: ['Identifiers, Keywords & Literals', 'Core Data Types & Mutability', 'Arithmetic, Floor Division & Bitwise Operators', 'Operator Precedence & Associativity'],
          },
          {
            id: 'm3-ch3',
            number: 3,
            title: 'Control Statements and Loops',
            titleHi: 'कंट्रोल स्टेटमेंट्स और लूप्स',
            description:
              'Decision making with if, if-else, if-elif-else, range() function, while and for loops, nested loops, and jump statements (break, continue, pass).',
            topics: ['if-elif-else Branching', 'for Loop & range() Function', 'while Loop & Loop-else Clause', 'break, continue & pass Statements'],
          },
          {
            id: 'm3-ch4',
            number: 4,
            title: 'List / Tuple / Dictionary and Strings',
            titleHi: 'लिस्ट / टपल / डिक्शनरी और स्ट्रिंग्स',
            description:
              'String indexing and slicing, list comprehension and methods (append, extend, pop, sort), immutable tuples, sets, and key-value dictionary operations.',
            topics: ['String Slicing & Methods', 'List Operations & Comprehensions', 'Tuple Packing & Unpacking', 'Dictionary Keys, Values & Set Operations'],
          },
          {
            id: 'm3-ch5',
            number: 5,
            title: 'Functions, Recursion and Modules',
            titleHi: 'फंक्शंस, रिकर्शन और मॉड्यूल्स',
            description:
              'Function definition, positional/default/keyword/variable-length arguments (*args, **kwargs), local vs global scope, lambda functions, recursion, and math/random modules.',
            topics: ['def, return & Argument Types', 'Local vs Global Scope (LEGB)', 'Lambda & Recursive Functions', 'Standard Modules (math, random, datetime)'],
          },
          {
            id: 'm3-ch6',
            number: 6,
            title: 'File Processing and NumPy Basics',
            titleHi: 'फाइल प्रोसेसिंग और NumPy बेसिक्स',
            description:
              'Text and binary file modes (r, w, a, rb, wb), read(), readline(), write(), seek(), tell(), pickle module, and NumPy ndarray creation, slicing, reshaping, and broadcasting.',
            topics: ['File Access Modes (r, w, a, r+, wb)', 'seek(), tell() & Pickle Module', 'NumPy ndarray Creation (arange, linspace)', 'Array Shape, Indexing & Vectorized Math'],
          },
        ],
      },
      {
        id: 'M4',
        code: 'M4-R5',
        title: 'M4 — Internet of Things and its Applications',
        titleHi: 'M4 — इंटरनेट ऑफ थिंग्स और इसके अनुप्रयोग',
        description:
          'Covers IoT architecture, communication protocols (MQTT, CoAP), sensors, actuators, Arduino UNO microcontroller, Embedded C programming, security, and smart applications.',
        syllabusSummary: [
          'IoT Architecture, M2M vs IoT, Protocols (MQTT, CoAP, ZigBee, BLE)',
          'Sensors (DHT11, Ultrasonic, PIR, LDR, Gas) & Actuators (DC, Servo, Relay)',
          'Microcontrollers vs Microprocessors & Arduino UNO Pin Architecture',
          'Embedded C Language: setup(), loop(), pinMode, digitalWrite, analogRead',
          'IoT Security Challenges, Cloud Integration & Smart City Use Cases',
        ],
        chapters: [
          {
            id: 'm4-ch1',
            number: 1,
            title: 'Introduction to IoT — Applications, Devices & Protocols',
            titleHi: 'IoT का परिचय — अनुप्रयोग, उपकरण और प्रोटोकॉल',
            description:
              'Characteristics of IoT, physical and logical design, IoT functional blocks, TCP/IP vs IoT protocol stack, MQTT, CoAP, HTTP, LoRaWAN, ZigBee, Bluetooth, and RFID.',
            topics: ['IoT Building Blocks & Levels', 'M2M vs IoT Architecture', 'MQTT (Publish/Subscribe) & CoAP', 'RFID, NFC, ZigBee & LoRaWAN'],
          },
          {
            id: 'm4-ch2',
            number: 2,
            title: 'Things and Connections (Sensors, Actuators & Networks)',
            titleHi: 'थिंग्स और कनेक्शन्स (सेंसर, एक्चुएटर और नेटवर्क)',
            description:
              'Closed-loop and open-loop control systems, analog vs digital sensors (DHT11, LM35, LDR, PIR, HC-SR04, MQ-2), relays, DC/Servo/Stepper motors, and wireless sensor networks.',
            topics: ['Open-Loop vs Closed-Loop Systems', 'Temperature, PIR, Ultrasonic & Gas Sensors', 'Relays, Servo & Stepper Actuators', 'Wireless Sensor Networks (WSN)'],
          },
          {
            id: 'm4-ch3',
            number: 3,
            title: 'Sensors, Actuators and Microcontrollers (Arduino)',
            titleHi: 'सेंसर, एक्चुएटर और माइक्रोकंट्रोलर (आर्डुइनो)',
            description:
              'Microprocessor vs Microcontroller, ATmega328P specifications, Arduino UNO R3 board layout, digital I/O pins, PWM pins (~), ADC resolution, I2C, SPI, and UART.',
            topics: ['ATmega328P & Arduino UNO R3 Specs', 'Digital, Analog (A0-A5) & PWM Pins', '10-bit ADC & Voltage Levels', 'Serial, I2C & SPI Interfaces'],
          },
          {
            id: 'm4-ch4',
            number: 4,
            title: 'Building IoT Applications (Arduino IDE & Embedded C)',
            titleHi: 'IoT अनुप्रयोगों का निर्माण (Arduino IDE और एम्बेडेड C)',
            description:
              'Arduino sketch structure (setup and loop), Embedded C data types, operators, control statements, pinMode(), digitalWrite(), digitalRead(), analogRead(), analogWrite(), and delay().',
            topics: ['setup() and loop() Lifecycle', 'pinMode, digitalRead & digitalWrite', 'analogRead (0-1023) & analogWrite (0-255)', 'Serial.begin(), LCD & Sensor Interfacing'],
          },
          {
            id: 'm4-ch5',
            number: 5,
            title: 'Security, Future of IoT Ecosystem and Soft Skills',
            titleHi: 'सुरक्षा, IoT पारिस्थितिकी तंत्र का भविष्य और सॉफ्ट स्किल्स',
            description:
              'IoT attack surfaces, botnets, OWASP IoT vulnerabilities, encryption, Edge/Fog computing, AIoT, and professional communication, personality development, and interview skills.',
            topics: ['IoT Security Threats & Botnets', 'Encryption & Device Authentication', 'Edge, Fog & Cloud in IoT', 'Communication & Technical Soft Skills'],
          },
        ],
      },
    ],
  },
  {
    id: 'ccc',
    name: 'CCC',
    shortName: 'NIELIT CCC',
    category: 'NIELIT Certification',
    description:
      'Course on Computer Concepts (CCC) preparation aligned with the latest NIELIT syllabus covering LibreOffice, Operating Systems, Digital Finance, and FutureSkills.',
    practiceModeLabel: 'Chapter-wise Bilingual CBT Practice',
    hasModules: false,
    hasChapters: true,
    syllabusOverview: [
      'Computer Basics, OS & LibreOffice Suite (Writer, Calc, Impress)',
      'Computer Networks, Internet, WWW & Web Browsers',
      'Email, Social Media, e-Governance & Digital Financial Tools',
      'Cyber Security & FutureSkills (IoT, Cloud, AI, Blockchain)',
    ],
    chapters: [
      {
        id: 'ccc-ch1',
        number: 1,
        title: 'Introduction to Computer',
        titleHi: 'कंप्यूटर का परिचय',
        description:
          'Generations of computers, hardware & software components, CPU, RAM/ROM, storage devices, input/output peripherals, and IT gadgets.',
        topics: ['Computer Generations (1st to 5th)', 'CPU, Memory & Storage Units', 'Input & Output Peripherals', 'Open Source vs Proprietary Software'],
      },
      {
        id: 'ccc-ch2',
        number: 2,
        title: 'Introduction to Operating System',
        titleHi: 'ऑपरेटिंग सिस्टम का परिचय',
        description:
          'Desktop and mobile OS, Ubuntu Linux & Windows user interface, taskbar, icons, system settings, printer management, and file extensions.',
        topics: ['Desktop & Mobile Operating Systems', 'Taskbar, Icons & Window Controls', 'File & Directory Properties', 'Linux Basics & System Utilities'],
      },
      {
        id: 'ccc-ch3',
        number: 3,
        title: 'Word Processing (LibreOffice Writer)',
        titleHi: 'वर्ड प्रोसेसिंग (लिब्रे ऑफिस राइटर)',
        description:
          'LibreOffice Writer interface, menu bar, zoom limits, default file extension (.odt), formatting shortcuts, tables, mail merge, and print preview.',
        topics: ['LibreOffice Writer Menus & Shortcuts', 'Default Font, Zoom & .odt Format', 'Tables, Find & Replace, Mail Merge', 'Headers, Footers & Watermarks'],
      },
      {
        id: 'ccc-ch4',
        number: 4,
        title: 'Spreadsheet (LibreOffice Calc)',
        titleHi: 'स्प्रेडशीट (लिब्रे ऑफिस कैल्क)',
        description:
          'LibreOffice Calc row/column limits, cell address, .ods extension, mathematical and logical functions (SUM, AVERAGE, COUNT, MAX, MIN, IF), and charts.',
        topics: ['Calc Row/Column Limits & .ods Format', 'Formulas, Functions & Error Codes', 'Cell Referencing & AutoFill', 'Charts, Sorting & Data Filters'],
      },
      {
        id: 'ccc-ch5',
        number: 5,
        title: 'Presentation (LibreOffice Impress)',
        titleHi: 'प्रेजेंटेशन (लिब्रे ऑफिस इम्प्रेस)',
        description:
          'LibreOffice Impress slide templates, master slide, .odp extension, zoom range, slide show shortcuts (F5), transitions, and animations.',
        topics: ['Impress Views & .odp Extension', 'Slide Master, Handouts & Notes', 'Slide Transitions & Custom Animations', 'Impress Keyboard Shortcuts'],
      },
      {
        id: 'ccc-ch6',
        number: 6,
        title: 'Introduction to Internet and WWW',
        titleHi: 'इंटरनेट और WWW का परिचय',
        description:
          'LAN/MAN/WAN, network topologies, guided/unguided media, MAC & IP addresses, OSI layers, web browsers, search engines, and URL structure.',
        topics: ['Network Types & Topologies', 'IPv4/IPv6, MAC & Port Numbers', 'HTTP, HTTPS, FTP & DNS', 'Web Browsers & Search Engines'],
      },
      {
        id: 'ccc-ch7',
        number: 7,
        title: 'E-mail, Social Networking and e-Governance Services',
        titleHi: 'ई-मेल, सोशल नेटवर्किंग और ई-गवर्नेंस',
        description:
          'Email structure, CC/BCC, attachment limits, social media platforms (Twitter/X, Facebook, LinkedIn, Instagram, Telegram), UMANG, DigiLocker, and Passport Seva.',
        topics: ['Email Protocols & Etiquette', 'Social Media & E-Commerce Models', 'UMANG, DigiLocker & SARATHI', 'Aadhaar, PAN & IRCTC Services'],
      },
      {
        id: 'ccc-ch8',
        number: 8,
        title: 'Digital Financial Tools and Applications',
        titleHi: 'डिजिटल वित्तीय उपकरण और अनुप्रयोग',
        description:
          'UPI, BHIM, AEPS, USSD (*99#), IFS Code, MICR, NEFT, RTGS, IMPS limits and timings, RuPay card, POS, and e-Wallet systems.',
        topics: ['UPI, BHIM, AEPS & USSD (*99#)', 'IFSC, MICR, NEFT, RTGS & IMPS', 'Credit/Debit Cards, CVV & OTP', 'Banking Schemes (PMJDY, PMSBY, APY)'],
      },
      {
        id: 'ccc-ch9',
        number: 9,
        title: 'Overview of FutureSkills and Cyber Security',
        titleHi: 'फ्यूचरस्किल्स और साइबर सुरक्षा',
        description:
          'IoT, Big Data, Cloud Computing, Virtual Reality, AI, Robotics, 3D Printing, Blockchain, malware, ransomware, trojans, keyloggers, and IT Act 2000.',
        topics: ['AI, IoT, Cloud & Blockchain', 'RPA, 3D Printing & Virtual Reality', 'Viruses, Trojan, Phishing & Spoofing', 'Encryption, Firewall & Cyber Laws'],
      },
    ],
  },
  {
    id: 'msexcel',
    name: 'MS Excel',
    shortName: 'Microsoft Excel',
    category: 'Office Productivity',
    description:
      'Comprehensive practice on workbooks, worksheets, cell referencing, formulas, lookup/logical functions, PivotTables, charts, data validation, and shortcuts.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Workbooks, Worksheets, Rows/Columns & Cell Referencing (Relative, Absolute, Mixed)',
      'Formulas & Functions: SUM, IF, VLOOKUP, XLOOKUP, INDEX-MATCH, COUNTIF, TEXT',
      'Charts, PivotTables, Conditional Formatting, Sorting, Filtering & Data Validation',
      'Page Setup, Freeze Panes, Workbook Protection & Keyboard Shortcuts',
    ],
  },
  {
    id: 'msword',
    name: 'MS Word',
    shortName: 'Microsoft Word',
    category: 'Office Productivity',
    description:
      'Practice tests covering document creation, paragraph formatting, styles, tables, page layout, headers/footers, mail merge, track changes, and Word shortcuts.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Document Creation, Font & Paragraph Formatting, Indents, Line Spacing & Styles',
      'Tables, Columns, Breaks, Page Setup, Margins, Headers, Footers & Watermarks',
      'Mail Merge (Main Document, Data Source, Merge Fields), Labels & Envelopes',
      'Track Changes, Comments, Table of Contents, Footnotes, Macros & Shortcuts',
    ],
  },
  {
    id: 'mspowerpoint',
    name: 'MS PowerPoint',
    shortName: 'Microsoft PowerPoint',
    category: 'Office Productivity',
    description:
      'Practice on presentation design, slide layouts, Slide Master, themes, transitions, custom animations, multimedia integration, presenter view, and shortcuts.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Slides, Placeholders, Slide Layouts, Design Themes & Variants',
      'Slide Master, Handout Master, Notes Master & Presentation Views',
      'Slide Transitions, Motion Paths, Animation Pane, Triggers & Rehearse Timings',
      'Action Buttons, Hyperlinks, Audio/Video Embedding & Slide Show Shortcuts',
    ],
  },
  {
    id: 'html',
    name: 'HTML',
    shortName: 'HTML5',
    category: 'Web & Programming',
    description:
      'Master HTML5 document structure, semantic elements, attributes, forms, input validation, tables, hyperlinks, responsive images, multimedia, and accessibility.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'HTML5 Document Boilerplate, Meta Tags, Headings, Block vs Inline Elements',
      'Hyperlinks, Image Attributes, Tables (thead, tbody, colspan, rowspan) & Lists',
      'HTML5 Forms, Input Types, Validation Attributes (required, pattern, min/max)',
      'Semantic Tags (header, nav, main, article, section), Audio/Video, Canvas & ARIA',
    ],
  },
  {
    id: 'css',
    name: 'CSS',
    shortName: 'CSS3',
    category: 'Web & Programming',
    description:
      'Test your command of CSS selectors, specificity rules, the box model, display properties, positioning, Flexbox, CSS Grid, media queries, and animations.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Selectors (Class, ID, Attribute, Combinators, Pseudo-classes) & Specificity',
      'Box Model (Margin, Border, Padding, box-sizing), Units (px, rem, em, vh/vw)',
      'Positioning (static, relative, absolute, fixed, sticky), Flexbox & CSS Grid',
      'Responsive Media Queries, Custom Properties (Variables), Transitions & Keyframes',
    ],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    shortName: 'JavaScript (ES6+)',
    category: 'Web & Programming',
    description:
      'Code-verified practice covering variables, scoping, data types, operators, functions, closures, arrays, objects, DOM manipulation, events, Promises, and async/await.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Variables (var, let, const), Hoisting, Data Types, Type Coercion & Operators',
      'Functions, Arrow Functions, Closures, Callbacks & Array Methods (map, filter, reduce)',
      'Objects, Prototypes, Destructuring, Spread/Rest & ES6 Modules',
      'DOM Selection, Event Bubbling/Delegation, Promises, Async/Await & Fetch API',
    ],
  },
  {
    id: 'python',
    name: 'Python',
    shortName: 'Python 3',
    category: 'Web & Programming',
    description:
      'Validated Python programming practice covering data types, slicing, lists, tuples, sets, dictionaries, comprehensions, functions, exceptions, file I/O, and OOP.',
    practiceModeLabel: 'Direct Topic-Mixed CBT Practice',
    hasModules: false,
    hasChapters: false,
    syllabusOverview: [
      'Variables, Dynamic Typing, Operators, Slicing & String Formatting',
      'Data Structures: Lists, Tuples, Sets, Dictionaries & Comprehensions',
      'Control Flow, Functions, *args/**kwargs, Lambda, Generators & Decorators',
      'Exception Handling (try-except-finally), File I/O, Modules & OOP (Classes, Inheritance)',
    ],
  },
];

export function getCourseById(courseId: string): CourseInfo | undefined {
  return COURSES.find((c) => c.id === courseId);
}

export function getModuleById(courseId: string, moduleId: string): ModuleInfo | undefined {
  const course = getCourseById(courseId);
  return course?.modules?.find((m) => m.id === moduleId);
}

export function getChapterById(
  courseId: string,
  chapterId: string,
  moduleId?: string
): ChapterInfo | undefined {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  if (course.hasModules && moduleId) {
    const mod = course.modules?.find((m) => m.id === moduleId);
    return mod?.chapters.find((ch) => ch.id === chapterId);
  }
  return course.chapters?.find((ch) => ch.id === chapterId);
}
