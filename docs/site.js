// Simple JavaScript for navigation and page management
class SiteManager {
    constructor() {
        this.pages = new Map();
        this.currentPage = '';
        this.init();
    }

    init() {
        // Initialize navigation
        this.setupNavigation();
        
        // Load initial page
        const hash = window.location.hash.slice(1) || 'home';
        this.loadPage(hash);
        
        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const page = window.location.hash.slice(1) || 'home';
            this.loadPage(page);
        });
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                if (page) {
                    window.location.hash = page;
                }
            });
        });
    }

    loadPage(pageId) {
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current page link
        const currentLink = document.querySelector(`[data-page="${pageId}"]`);
        if (currentLink) {
            currentLink.classList.add('active');
        }
        
        // Load page content
        this.displayPage(pageId);
        this.currentPage = pageId;
    }

    displayPage(pageId) {
        const mainContent = document.querySelector('.main-content');
        
        switch(pageId) {
            case 'home':
                mainContent.innerHTML = this.getHomePage();
                break;
            case 'getting-started':
                mainContent.innerHTML = this.getGettingStartedPage();
                break;
            case 'key-concepts':
                mainContent.innerHTML = this.getKeyConceptsPage();
                break;
            case 'launch-screen':
                mainContent.innerHTML = this.getLaunchScreenPage();
                break;
            case 'selecting-template':
                mainContent.innerHTML = this.getSelectingTemplatePage();
                break;
            case 'interface':
                mainContent.innerHTML = this.getInterfacePage();
                break;
            case 'working-with-labels':
                mainContent.innerHTML = this.getWorkingWithLabelsPage();
                break;
            case 'keyboard-shortcuts':
                mainContent.innerHTML = this.getKeyboardShortcutsPage();
                break;
            case 'downloads':
                mainContent.innerHTML = this.getDownloadsPage();
                break;
            case 'map-varieties':
                mainContent.innerHTML = this.getMapVarietiesPage();
                break;
            case 'indesign-maps':
                mainContent.innerHTML = this.getInDesignMapsPage();
                break;
            case 'map-creator-maps':
                mainContent.innerHTML = this.getMapCreatorMapsPage();
                break;
            case 'feedback':
                mainContent.innerHTML = this.getFeedbackPage();
                break;
            default:
                mainContent.innerHTML = this.getHomePage();
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    getHomePage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Paratext Diagram Labeler</h1>
                <p class="page-subtitle">Prepare labels for maps and diagrams in your Paratext projects</p>
            </div>
            
            <div class="info-card warning-card">
                <h3>🚧 Beta Software Notice</h3>
                <p>This is beta software primarily intended to test the user experience for integration into Paratext 10. 
                If you haven't already, please join the beta test program by sending an email to 
                <a href="mailto:labeler+subscribe@groups.sall.com">labeler+subscribe@groups.sall.com</a>.</p>
            </div>

            <div class="content-section">
                <h2 class="section-title">Purpose</h2>
                <p>The Labeler is a tool to prepare labels for maps and other diagrams to be used in a Paratext project. 
                It helps ensure that the labels you use on maps and diagrams in Map Creator or Adobe InDesign actually 
                match the terms used in your Scripture text.</p>
                
                <p>Note that while the work is done in a graphical layout, the goal is not to create an image, but to 
                collect the labels to be used on a map or diagram in either Map Creator or InDesign.</p>
            </div>

            <div class="content-section">
                <h2 class="section-title">Key Features</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                    <div class="info-card">
                        <h3>📍 Smart Label Management</h3>
                        <p>Automatically sync your map labels with terms used in your Scripture text</p>
                    </div>
                    <div class="info-card">
                        <h3>🗺️ Multiple Views</h3>
                        <p>Work with Map View, Table View, and USFM Preview to match your workflow</p>
                    </div>
                    <div class="info-card">
                        <h3>🔄 Paratext Integration</h3>
                        <p>Works with Paratext 8 and 9 project files, with Paratext 10 integration planned</p>
                    </div>
                    <div class="info-card">
                        <h3>📤 Export Ready</h3>
                        <p>Generate data merge files for use in Map Creator or Adobe InDesign</p>
                    </div>
                </div>
            </div>

            <div class="content-section">
                <h2 class="section-title">Current Status</h2>
                <p>This standalone React app works with Paratext 8 or 9 project files. The goal is to create an 
                extension that is fully integrated in Paratext 10. The current version serves to test the user 
                experience before full integration.</p>
                
                <div class="info-card">
                    <h3>Beta Limitations</h3>
                    <ul>
                        <li>No patch system - upgrades require downloading and running the full installer</li>
                        <li>Data structures may change during development</li>
                        <li>Mac and Linux versions are less tested than Windows</li>
                    </ul>
                </div>
            </div>
        `;
    }

    getKeyConceptsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Key Concepts</h1>
                <p class="page-subtitle">Understanding how the Labeler works with your project</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Core Concepts</h2>
                
                <div class="info-card">
                    <ul>
                        <li>A project's <strong>Term Renderings</strong> is where the Labeler will look for text to use in labels.</li>
                        
                        <li>Wherever possible, it looks for the term ID as used in Paratext's Major Biblical Terms list, generally a single Greek or Hebrew word. E.g. Ναζαρά for Nazareth.</li>
                        
                        <li>In some cases, a label such as "Mediterranean Sea" does not have a corresponding word in the source texts, and so a term ID like "mediterranean_sea" is used instead. This is fairly transparent to the user.</li>
                        
                        <li>You store your labels in the Term Renderings so that they will be automatically available on other maps and diagrams. The <a href="#working-with-labels">color-coded statuses</a> will help to ensure that you've done this consistently. However, you are free to export and use labels no matter what status they have. You may have valid reasons not to match the label used for the same location on a different map. E.g. A place is labeled "Mizpah" on one map, but "Mizpah of Moab" on another. But the status will at least make you aware of the difference.</li>
                        
                        <li>There are two ways that you can save diagram labels for later use:</li>
                    </ul>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Saving Your Work</h2>
                
                <div class="info-card">
                    <h3>Method 1: IDML Data Merge Files</h3>
                    <p>You can export all the labels for a diagram into an IDML data merge file, which is the format from which you could merge them into an IDML diagram. It is recommended that you save these in the <code>shared\\labeler</code> folder within your project folder, so that they are included in your send/receive.</p>
                </div>
                
                <div class="info-card">
                    <h3>Method 2: USFM Representation</h3>
                    <p>You can save the USFM representation of the diagram in any appropriate location in your Paratext project, just like you do with \\fig fields to store illustration information. (It is not tied to chapters and verses in an XX book, as was the case with the Scripture Map Labeler.) For this, you must currently copy and paste between the USFM in/out control and your Paratext project. (For the Paratext 10 extension, this would be automatic.) However, the USFM representation has not been finalized, and may change, so it's recommended that for the time being, you store your diagram labels in IDML data merge files.</p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Map Collections</h2>
                
                <div class="info-card">
                    <p>Multiple organizations may distribute collections of maps and other diagrams, and the Labeler will be able to work with any of them, as well as with custom, private collections.</p>
                </div>
            </div>
        `;
    }

    // Page content methods will be implemented as we build each page
    getGettingStartedPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Getting Started</h1>
                <p class="page-subtitle">Prerequisites and installation guide</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Prerequisites</h2>
                <div class="info-card">
                    <h3>Required Software</h3>
                    <ul>
                        <li><strong>Paratext 9</strong> should already be installed</li>
                        <li>Either <a href="https://fmosoft.com/map-creator">Map Creator</a> to work with .mapx files or 
                            <a href="https://www.adobe.com/products/indesign.html">Adobe InDesign</a> to work with .idml files</li>
                    </ul>
                </div>
                
                <div class="info-card">
                    <h3>Paratext Project Setup</h3>
                    <p>In your Paratext project, it's highly recommended that you at least have the Biblical Terms tool 
                    guess renderings for all Names. Some diagrams will also benefit from Realia guessed renderings.</p>
                </div>
                
                <div class="info-card">
                    <h3>Required Map Collections</h3>
                    <ul>
                        <li>Download all maps and diagrams from the <a href="https://tiny.cc/sil-maps">SIL Map Repository</a>
                            <br><em>Tip: Download the <strong>compact</strong> edition, not the expanded edition, which only adds redundant clutter.</em></li>
                        <li>For Map Creator built-in maps, also download 
                            <a href="https://drive.google.com/file/d/1XS42-dX2XWoEVWg3jZeTkpujb2dPdPVj/view?usp=drive_link">fmosoft Master Maps - SMR edition.zip</a>
                            and unzip to a convenient location with your other master map files.</li>
                    </ul>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Installation</h2>
                <ol>
                    <li>Visit the <a href="#downloads">Downloads</a> page or go directly to the 
                        <a href="https://github.com/sillsdev/paratext-diagram-labeler/releases">GitHub Releases page</a></li>
                    <li>Download the <strong>Paratext Diagram Labeler Setup</strong> program for your operating system</li>
                    <li>Run the installer and follow the setup instructions</li>
                </ol>
            </div>            
        `;
    }

    getLaunchScreenPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Launching the Labeler</h1>
                <p class="page-subtitle">The pre-launch screen and settings</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Starting the Application</h2>
                <p>On Windows, the <strong>Paratext Diagram Labeler</strong> should appear in your Start menu, or you can run the executable from wherever you installed it.</p>
                
                <p>You will see the "pre-Launch" screen that contains the context that the Paratext 10 extension will (in the future) provide:</p>
                
                <div class="info-card">
                    <img src="images/image7.png" alt="Pre-Launch Screen" style="max-width: 100%;">
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Settings</h2>
                
                <div class="info-card">
                    <h3>Template Folder</h3>
                    <p>The installer initially places the templates folder (<strong>_LabelerTemplates</strong>) in the same folder as the Paratext Diagram Labeler executable. It's recommended that you leave it there, so that when you install an updated version, you'll be able to immediately use the updated files.</p>
                </div>
                
                <div class="info-card">
                    <h3>Project Folder</h3>
                    <p>Specify the full path to your Paratext project folder. E.g. "C:\\My Paratext 9 Projects\\Zezi".</p>
                </div>
                
                <div class="info-card">
                    <h3>Save Renderings To</h3>
                    <p>If you don't want the Labeler to directly modify your <strong>TermsRendering.xml</strong> file (that Paratext uses), select <strong>TermsRenderings-Demo.xml</strong> instead. Once you're satisfied with the changes to this file, you can replace your original <strong>TermRenderings.xml</strong> file with it.</p>
                </div>
                
                <div class="info-card">
                    <h3>USFM In/Out</h3>
                    <p>If you paste a USFM representation of a diagram into this space, Labeler will use it when launched. Clicking the OK button after Labeler is launched will return the diagram's USFM representation. It will persist there for subsequent uses of the Labeler, or you can copy and paste it into an appropriate location in your Paratext project.</p>
                    
                    <p>If this area does not contain relevant USFM, you'll be prompted to browse for a diagram template when you click the Launch button.</p>
                </div>
                
                <p>Once these settings provide the necessary context for the Labeler, click the Launch button.</p>
            </div>
        `;
    }

    getSelectingTemplatePage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Selecting a Diagram Template</h1>
                <p class="page-subtitle">How to browse and choose map templates</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Opening the Template Browser</h2>
                <p>If you click the Launch button with no template specified in the USFM, or if you ever click the "Browse for map template" button (its icon looks like a yellow file folder), this will open the system file picker dialog, like this (on Windows machines):</p>
                
                <div class="info-card">
                    <img src="images/image2.png" alt="File picker dialog" style="max-width: 100%;">
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Browsing Templates</h2>
                
                <div class="info-card">
                    <ul>
                        <li>It's recommended that you make this dialog as large as possible, and then choose "Extra large icons" to display. <span class="maroonOval">1</span> You may also want to toggle the preview pane on if it's hidden, for a closer view of template images.</li>
                        
                        <li>The first time you run Paratext Diagram Labeler, it copies "!All Map Samples" to your Pictures folder. The advantage of it being there is that it will be indexed. If you don't need the Spanish versions, you can delete the <code>SMR @es</code> folder.</li>
                        
                        <li>Navigate to that folder.</li>
                        
                        <li>You can browse the images without filtering, but it may be faster to find a suitable map by using the search bar. In the above example, we searched for <span class="searchTerm">armor</span>. <span class="maroonOval">2</span>
                        
                        <br><br>If you wanted to see all the samples of black and white maps of Paul's third missionary journey, you could use a search for <span class="searchTerm">bw AND paul</span> or <span class="searchTerm">bw AND act18</span>. To further restrict the search to only maps supported by InDesign or Map Creator, add the keyword <span class="searchTerm">IDML</span> or <span class="searchTerm">MAPX</span> respectively. E.g. "<span class="searchTerm">bw AND paul AND mapx</span>".
                        
                        <br><br>All sample maps are also tagged with one of the following searchable tags that indicate the type of map:
                        
                        <ul style="margin-top: 0.5rem;">
                            <li><span class="searchTerm">BWR</span>: black & white, relief</li>
                            <li><span class="searchTerm">BWF</span>: black & white, flat</li>
                            <li><span class="searchTerm">BBR</span>: blue & brown, relief</li>
                            <li><span class="searchTerm">BBF</span>: blue & brown, flat</li>
                            <li><span class="searchTerm">FCR</span>: full color, relief</li>
                            <li><span class="searchTerm">FCF</span>: full color, flat</li>
                            <li><span class="searchTerm">MCR</span>: muted color, relief</li>
                        </ul>
                        
                        <br>Other example searches:
                        <ul style="margin-top: 0.5rem;">
                            <li><span class="searchTerm">mapx</span> - All Map Creator maps</li>
                            <li><span class="searchTerm">fcr OR bbr</span> - Maps with full color relief OR blue-brown relief versions available</li>
                            <li><span class="searchTerm">bwf idml</span> - Black & White flat maps in IDML format</li>
                            <li><span class="searchTerm">ACT08</span> - Maps for Acts 8</li>
                            <li><span class="searchTerm">*gt</span> - Greg Thompson maps/diagrams</li>
                        </ul></li>
                        
                        <li>Note that the first time you run this, the operating system may not have had time yet to index the sample maps, so searching by keyword might not work until your machine has had enough idle time to finish indexing.</li>
                        
                        <li>While the sample maps folder contains separate images for the different varieties that one master file can produce, it won't matter which of these you select to identify the template.</li>
                        
                        <li>Once you've selected the template you want to use, click the <strong>Open</strong> button.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    getInterfacePage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Using the Labeler</h1>
                <p class="page-subtitle">Understanding the Labeler's main interface</p>
            </div>
            
            <div class="content-section">
                <p>You can think of the launched Labeler window as an enhanced version of the familiar Biblical Terms tool. It is divided into three resizable panes, like this:</p>
                
                <div class="info-card">
                    <img src="images/image10.png" alt="Main Labeler Interface" style="max-width: 100%;">
                </div>
                
                <p>The <strong>main pane</strong> <span class="maroonOval">1</span> is typically used in "map view" to show the labels overlaid on an image. Each of the labels is color-coded to indicate the kind of attention that the label may need. Please see the <a href="#working-with-labels">Label Status</a> topic below for details. The <strong>zoom buttons</strong> <span class="maroonOval">2</span> enable zooming in and out on the diagram.</p>
                
                <p>In the <strong>details pane</strong> on the right, the <strong>view buttons</strong> <span class="maroonOval">3</span> enable you to select between "map view", "table view", and "USFM view" to be shown in the main pane.</p>
                
                <p>The <strong>OK</strong> and <strong>Cancel</strong> buttons <span class="maroonOval">4</span> will return you to the pre-launch screen, with or without updating the USFM representation there.</p>
                
                <p>The <strong>Settings</strong> cog <span class="maroonOval">5</span> provides access to various user-interface settings:</p>
                
                <table style="width: 100%; margin: 1rem 0;">
                    <tr>
                        <td style="width: 40%; vertical-align: top;">
                            <img src="images/image16.png" alt="Settings Menu" style="max-width: 100%;">
                        </td>
                        <td style="vertical-align: top; padding-left: 1rem;">
                            <p><strong>Label Size:</strong> Scale the labels to balance readability with space efficiency on your screen.</p>
                            <p><strong>Label Opacity:</strong> Reduce opacity to see the underlying sample of style that will be applied in Map Creator / InDesign.</p>
                            <p><strong>Language:</strong> Select a language for the user interface. (Note that the strings in other languages are currently just A.I.-translated, not yet human-checked.)</p>
                            <p><strong>Show tally fractions:</strong> Check this box to display the fraction of found renderings directly on the labels.</p>
                        </td>
                    </tr>
                </table>
                
                <p>The <strong>template group</strong> <span class="maroonOval">6</span> displays the name of the current diagram template, and provides buttons for the following template actions:</p>
                <ul>
                    <li><strong style="background: #4a86e8; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">Template Info</strong>: Display information about the current diagram, including a link to usage and attribution rules.</li>
                    <li><strong style="background: #ffd966; color: black; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">Browse for Template</strong>: Load a different diagram by browsing either for a template JPG image, or for an IDML data merge file that you've previously saved, as described in the <a href="#selecting-template">Selecting a Diagram Template</a> section above.</li>
                    <li><strong style="color: #1155cc; font-size: 0.8em;">Export to Data Merge File</strong>: Use this to save your current diagram to a text file for data merge into either InDesign (IDML) or Map Creator (MAPX) master files. It's recommended that you save such files to your project's <code>shared\\labeler</code> folder, so that they will be included in Paratext's send/receive.</li>
                </ul>
                
                <p>The <strong>tally box</strong> <span class="maroonOval">7</span> displays the count of each status of label in the diagram.</p>
                
                <p>The <strong>label group</strong> <span class="maroonOval">8</span> displays:</p>
                <ul>
                    <li>information about the currently selected label, including the major-language gloss, the source-language Biblical term, and some contextual information to aid in translation.</li>
                    <li>an expandable <strong>vernacular label box</strong> <span class="maroonOval">9</span> in which you can provide or edit the vernacular text for that label, and see a detailed explanation of that label's status, in some cases with quick action buttons.</li>
                    <li>the <strong>term renderings</strong> box <span class="maroonOval">10</span>, in which you can edit your term renderings. (Note: Term rendering history tracking is not yet implemented.)</li>
                </ul>
                
                <p>The <strong>bottom pane</strong> <span class="maroonOval">11</span> displays the available Scripture verses where the term is expected to appear if the translation team has used the term consistently.</p>
                
                <p>Three <strong>filter buttons</strong> <span class="maroonOval">12</span> control which verses are displayed:</p>
                <ul>
                    <li><strong>Show all verses</strong>: Shows all available verses.</li>
                    <li><strong>Show only verses without matching renderings</strong>: Allows you to focus on just the missing renderings.</li>
                    <li><strong>Show unique forms</strong>: Displays just the first occurrence of each inflected form of the rendering.</li>
                </ul>
                
                <p>If any text in the bottom pane is selected, two additional buttons <span class="maroonOval">13</span> become available:</p>
                <ul>
                    <li><strong>Add rendering</strong>: Adds the selected text to the term renderings box as a new rendering.</li>
                    <li><strong>Replace renderings and label</strong>: Replaces the contents of both the terms rendering box and the vernacular label box with the selected text.</li>
                </ul>
                
                <p>There are two buttons at the left edge of each verse in the bottom pane <span class="maroonOval">14</span>:</p>
                <ul>
                    <li><strong>Found status</strong>:
                        <ul>
                            <li>A green checkmark indicates the term has been found.</li>
                            <li>A red X indicates that the term is missing from this verse. If it's OK that it's missing, click the red X to deny that it's a problem.</li>
                            <li>A green checkmark with a small red X indicates that you've examined the verse and denied that the missing rendering is the problem.</li>
                        </ul>
                    </li>
                    <li><strong>Edit verse</strong>: Click the pencil icon to edit the verse in Paratext. (On Windows, Paratext should scroll to the selected verse.)</li>
                </ul>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Table View</h2>
                <p>Table View is just like Map View, but with labels provided in a table instead of being positioned on an image:</p>
                
                <div class="info-card">
                    <img src="images/image13.png" alt="Table View" style="max-width: 100%;">
                </div>
                
                <p>Even if the chosen template is not available on a particular local system, opening a diagram definition (from an *.idml.txt file or from USFM) is at least editable in Table View.</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">USFM View</h2>
                <p>The USFM view displays how the diagram and its labels might be currently represented in USFM 3. Please note that this is subject to change, so at the current time, it is recommended that you save your work by exporting to *.idml.txt files rather than by copying and pasting USFM text to/from your Paratext project.</p>
            </div>
        `;
    }

    getWorkingWithLabelsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Working with Labels</h1>
                <p class="page-subtitle">Understanding and managing your map labels</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Label Status System</h2>
                <p>Each label in the Labeler is color-coded to indicate the kind of attention it may need. 
                Here are the different statuses and their meanings:</p>
                
                <div class="info-card">
                    <img src="images/statuses.png" alt="Label Status Indicators" style="max-width: 100%;">
                    <p><em>Different label statuses and their color indicators</em></p>
                </div>
                
            
            
            <div class="content-section">
                <h2 class="section-title">Data Merge Files</h2>
                <p>Once you've completed your label work, the Labeler can generate data merge files for use in Map Creator or Adobe InDesign.</p>
                <p>For detailed instructions on using the exported files, see the <a href="#map-varieties">Making Maps</a> sections.</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Migrating Data from Scripture Map Labeler</h2>
                <p>If you've created maps already with the current version of Scripture Map Labeler, those labels will be accessible to you in Paratext Diagram Labeler if you took the step of ensuring your labels were copied into the term renderings. If you have not done that, the easiest way to do that now is to use the <a href="https://tiny.cc/maplabelerhelper">Map Labeler Helper's</a> "Commit Labels" tool.</p>
            </div>
        `;
    }

    getKeyboardShortcutsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Keyboard Shortcuts</h1>
                <p class="page-subtitle">Speed up your workflow with these shortcuts</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Navigation Shortcuts</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Shortcut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>PgDn</code></td>
                            <td>Cycle forwards through the labels</td>
                        </tr>
                        <tr>
                            <td><code>PgUp</code></td>
                            <td>Cycle backwards through the labels</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Zoom Shortcuts</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Shortcut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>Ctrl</code> + <code>+</code></td>
                            <td>Zoom in (increase scale of all text elements)</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>-</code></td>
                            <td>Zoom out (decrease scale of all text elements)</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>0</code></td>
                            <td>Reset text zoom to default scale</td>
                        </tr>
                        <tr>
                            <td><code>Ctrl</code> + <code>9</code></td>
                            <td>Reset map zoom to fit window</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    getDownloadsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Downloads</h1>
                <p class="page-subtitle">Get the latest version of Paratext Diagram Labeler</p>
            </div>
            
            <div class="content-section">
                <div class="info-card warning-card">
                    <h3>Beta Software Notice</h3>
                    <p>Remember that this is beta software. There is no patch system - upgrading to the latest version 
                    means downloading the installer again and running it to replace your previous version.</p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">System Requirements</h2>
                <div class="info-card">
                    <ul>
                        <li><strong>Windows:</strong> Windows 10 or later (primary supported platform)</li>
                        <li><strong>Mac:</strong> macOS 10.14 or later (less tested)</li>
                        <li><strong>Linux:</strong> Modern Linux distributions (less tested)</li>
                    </ul>
                    <p><em>Note: Mac and Linux versions are relatively untested. We'd appreciate help testing them out.</em></p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Latest Releases</h2>
                <p>Download the latest version from GitHub Releases:</p>
                
                <div class="info-card">
                    <h3>🔗 GitHub Releases</h3>
                    <p>Visit the official releases page to download the latest version of Paratext Diagram Labeler:</p>
                    <a href="https://github.com/sillsdev/paratext-diagram-labeler/releases" target="_blank" class="btn" style="display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0;">
                        📥 Download from GitHub Releases
                    </a>
                    <p style="margin-top: 10px;"><small><em>Opens in a new tab</em></small></p>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff;">
                        <h4>What you'll find on the releases page:</h4>
                        <ul style="margin: 10px 0;">
                            <li><strong>Latest stable version</strong> - Recommended for most users</li>
                            <li><strong>Beta releases</strong> - For testing new features</li>
                            <li><strong>Download assets</strong> - Installers for Windows, Mac, and Linux</li>
                            <li><strong>Release notes</strong> - What's new in each version</li>
                        </ul>
                    </div>
                </div>
                
                <div class="info-card">
                    <h3>Installation Instructions</h3>
                    <ol>
                        <li>Download the <strong>Paratext Diagram Labeler Setup</strong> program for your operating system</li>
                        <li>Run the installer with administrator privileges if required</li>
                        <li>Follow the setup wizard instructions</li>
                        <li>The application will appear in your Start menu (Windows) or Applications folder (Mac)</li>
                    </ol>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Previous Versions</h2>
                <p>You can access previous releases from the GitHub releases page above. However, we recommend 
                using the latest version for the best experience and latest bug fixes.</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Need Help?</h2>
                <div class="info-card">
                    <p>If you encounter issues with installation or downloading:</p>
                    <ul>
                        <li>Check the <a href="#feedback">Feedback & Support</a> page for help</li>
                        <li>Join the beta testing program for updates and support</li>
                        <li>Report issues on the GitHub repository</li>
                    </ul>
                </div>
            </div>
        `;
    }

    getMapVarietiesPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Understanding Map Varieties</h1>
                <p class="page-subtitle">SIL Map Repository filename conventions and options</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Map Grouping System</h2>
                <p>Similar maps are grouped with the same chronology number, which the maps were grouped with for use with the predecessor system on PT9 known as "SMP". For example, 185 indicates maps relating to Philip's travels. In the SIL Map Repository (SMR), there are three separate IDML files for <code>185wbt - Philips Travels</code>:</p>
                
                <table style="width: 100%; margin: 1rem 0; border-collapse: collapse;">
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;"><code>185wbt - Philips Travels.idml</code></td>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;">Full page color map</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;"><code>185wbt - Philips Travels [sm].idml</code></td>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;">Shorter, more square color map</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;"><code>185wbt - Philips Travels [sm-bw].idml</code></td>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;">Black & white version of the shorter map</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Internal Map Options</h2>
                <p>Many maps have multiple options for display all within one IDML file. As you browse through the map samples, the internal options used are indicated within parentheses. For example, options on two varieties of the World map are (bbf, riv) and (fcr):</p>
                
                <table style="width: 100%; margin: 1rem 0; border-collapse: collapse;">
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;"><code>265wbt - World [1pg] (bbf riv) @en.jpg</code></td>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;">Black & Blue, showing rivers</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;"><code>265wbt - World [2pg-flipped] (fcr) @en.jpg</code></td>
                            <td style="border: 1px solid #ddd; padding: 0.5rem;">Full color relief</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="info-card">
                    <h3>Filename Conventions</h3>
                    <p>Please familiarize yourself with our maps' filename conventions described <a href="https://docs.google.com/spreadsheets/d/19xkEnd3x17eFAqChwzT6i9CmDxCJplLr/edit?gid=1704341479#gid=1704341479">here</a>.</p>
                </div>
            </div>
        `;
    }

    getInDesignMapsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Working with InDesign Maps</h1>
                <p class="page-subtitle">Complete guide for typesetting with IDML files</p>
            </div>
            
            <div class="content-section">
                <div class="info-card">
                    <h3>Using InDesign Data Merge - Create the InDesign file</h3>
                    
                    <ol>
                        <li>For the map you wish to typeset, open the downloaded InDesign file which does NOT have "@en" or other language code as part of the filename. (All maps are now distributed as .idml files instead of the usual .indd. This format is supported back to CS4.)</li>
                    </ol>
                    
                    <p>InDesign maps in SMP1 no longer have links to separate artwork files. All content is embedded directly in the .idml file.</p>
                    
                    <ol start="2">
                        <li>If your maps use a Roman-based writing system, all you'll need to do is ensure that the <a href="https://software.sil.org/charis/download/">Charis SIL</a> and <a href="https://software.sil.org/andika/download/">Andika</a> fonts are installed on your system. If you receive a message that you have missing fonts, simply install the versions of these fonts that can be found in the "Document fonts" subfolder in the top level of "SIL Maps Repository".</li>
                        
                        <li>Many of these InDesign maps support multiple options within one IDML file, most often the map type (such as "full color relief" or "black & white flat") and sometimes other variations (such as "complex routes" vs "simple routes" on the Exodus map). You can manually toggle layers to get the variation you're wanting. Note that some paragraph styles like "Ocean" and "Region" use color swatches named "Water color" and "Region color", and if you're wanting a black & white map, you'll need to change these paragraph styles to use the swatches named "Water BW" and "Region BW" instead. However, there's a better option: You can install the <a href="https://docs.google.com/document/d/1HjbQR9Q1zXQq_S0_xfODlRk2jovf8GHTKxWJuR5oBp4/edit?usp=sharing">MapMonkey</a> script, and run this whenever you want to "monkey" with the map options, either before or after the data merge. For example, you might want a black & white map for your print publication, but the color version of it for your Scripture app. For more information, visit the <a href="http://tiny.cc/mapmonkey">MapMonkey</a> page.</li>
                        
                        <li>If your maps use a non-Roman writing system, you will need to ensure that the definitions of the <code>font1</code> and <code>font2</code> paragraphs styles specify the font and any other properties that are required for proper rendering. All styles used for labels inherit the writing system properties from these two styles.
                            <ol>
                                <li>Example: For a map that uses Devanagari script and Western digits, in the <code>font1</code> and <code>font2</code> paragraph styles, set the font to <a href="https://software.sil.org/annapurna/download/">Annapurna SIL</a>, set the justification to "Adobe World-Ready Paragraph Composer", and set the language to "Hindi".
                                    <ol>
                                        <li>Alternatively, for this particular case, you may simply <a href="https://www.google.com/search?q=how+to+import+all+text+styles+in+indesign">import these paragraph definitions</a> from the <code>Deva_AnnapurnaSIL_WesternDigits.indd</code> file which can be found in the <code>!Styles</code> folder at the root of the map repository.</li>
                                    </ol>
                                </li>
                                <li>If the fonts that you are using do not have native bold and/or italic faces, you will need to edit the respective paragraphs styles (e.g. <code>font1 bold italic</code>) to fake the face appropriately, such as by adding a very slight outer stroke to fake bold, and/or skew for italics.</li>
                                <li>The <code>Regions</code> paragraph style typically employs expanded tracking in Roman-script projects, but the amount of expansion may be inappropriate in other writing systems. For this reason, you can modify the <code>expanded</code> character style to set an appropriate tracking property.</li>
                                <li>If your writing system uses a numeral system supported natively by InDesign, (that is, Bengali, Burmese, Devanagari, Farsi, Full Farsi, Gujarati, Gurmukhi, Eastern Arabic ["Hindi"], Kannada, Khmer, Lao, Malayalam, Oriya, Tamil, Telugu, Thai, or Tibetan), it will not be necessary to manually replace the Western digits on the map (such as for the scale) with local digits. InDesign can render the normal digit characters (codepoints U+0030 to U+0039) as if they were in various other numeral systems, without needing to replace the actual numerical characters. The <code>!AllDigitStyles.indd</code> file (which can likewise be found in the <code>!Styles</code> folder) contains a paragraph style for each of these numeral systems. By loading a style from that document into your map, and basing a style in that document on this style, you can control the digit system that InDesign uses to render normal digits.
                                    <ol>
                                        <li>For example, for a map that uses Devanagari script and Devanagari digits, import the <code>devanagari digits</code> paragraph style into your map from the <code>!AllDigitStyles.indd</code> file, and then base the definition of <code>font1</code> and <code>font2</code> on this paragraph style.
                                            <ol>
                                                <li>Alternatively, for this particular case, you could import all paragraph styles from the <code>Deva_AnnapurnaSIL_DevaDigits.indd</code> file into your map.</li>
                                            </ol>
                                        </li>
                                    </ol>
                                </li>
                                <li>Once you have set up your <code>font1</code> and <code>font2</code> styles appropriately for your writing system, save a copy of this document to be used as the import source for all maps. If it could be helpful for other typesetters who may use the same writing system, please submit a copy to the repository manager at <a href="mailto:maps-illustrationsrepository_intl@sil.org">maps-illustrationsrepository_intl@sil.org</a>.</li>
                            </ol>
                        </li>
                    </ol>
                    
                    <ol start="5">
                        <li>If you have all the needed fonts installed on your computer but you are still seeing a pink highlight behind your text, that is an indication that your font is still missing. Check to make sure there are no Character Styles applied. Removing them should fix your issue.</li>
                        <li>Open the Layers panel (Windows/Layers). This panel provides a number of customization possibilities, so explore it thoroughly. There is often a layer titled "Map Choices". Click the > symbol to the left to view the variations. Toggle the layer's visibility by clicking on the eyeball symbol.</li>
                        <li>If you choose a map that has a black & white layer available, you can either apply the bw version of the styles to the appropriate layers or redefine the "<code>Regions</code>", "<code>Water</code>", "<code>Ocean</code>", and "<code>Seas</code>" paragraph styles to use the "BW" versions of the color swatches. (e.g. Edit the style, and under Character Color, instead of the "Region color" swatch, select the "Region BW" swatch.)</li>
                    </ol>
                </div>
                
                <div class="info-card">
                    <h3>Using InDesign Merge - Data Merging</h3>
                    
                    <ol>
                        <li>Make a copy of the repository map (.idml) to work from. We recommend saving the file in the project \\local\\figures directory and prefixing the file with project name. Allow InDesign to change the extension to .indd. (If the original was named e.g. <code>155wbt - Holy Land.idml</code>, and your Paratext project was e.g. LUC_TEST, your master copy file would be <code>luctest_155wbt - Holy Land.indd</code>)</li>
                        
                        <li>Go to the InDesign menu item "Window" and navigate to "Utilities". Choose "Data Merge" from the fly-out menu. Go to the Panel Menu icon (stacked horizontal lines in the upper right corner of the Data Merge panel) <img src="images/image_B10.png" alt="Panel Menu Icon" style="vertical-align: middle; max-height: 20px;"> and choose "Select Data Source."</li>
                        
                        <li>The data source files for each map will be found in the Paratext Projects \\local\\figures folder, unless you specified another destination. It is a text (.txt) file with the same name as the map (including .idml), prefixed by the project name. For example, <code>luctest_155wbt - Holy Land.idml.txt</code> The list should populate the Data Merge panel.</li>
                    </ol>
                    
                    <div class="info-card">
                        <img src="images/image_B3.jpg" alt="Data Merge Process" style="max-width: 100%; margin: 1rem 0;">
                    </div>
                    
                    <p>Choose "Preview" by checking the box in the lower left corner of the Data Merge panel. The text fields in your document should change to reflect your own data, i.e. the vernacular text from the project.</p>
                    
                    <div style="display: flex; align-items: flex-start; margin: 1rem 0;">
                        <img src="images/image_B5.png" alt="Data Merge Panel" style="max-width: 200px; margin-right: 1rem;">
                        <div>
                            <ol start="4">
                                <li><strong>Continuing to work in preview mode</strong>, adjust your map as follows:</li>
                            </ol>
                            
                            <p>Using the Selection tool (top arrow in the toolbox), select any text boxes that have a red "X" that indicates there is overset text. You can also check for overset text by looking at the Preflight Panel indicator at the bottom of your InDesign window:</p>
                            
                            <img src="images/image_B2.png" alt="Preflight Panel Indicator" style="max-width: 100%; margin: 0.5rem 0;">
                        </div>
                    </div>
                    
                    <p>Reposition and resize any text boxes as needed. Resizing is most easily done with ctrl-alt-c (Fit frame to content) and the height and width menus in the control panel. Of course you can click and drag as well. You can adjust the font size of an individual entry or change the paragraph style so that you adjust the size of all of the "cities", for example. Either can be appropriate at different times.</p>
                    
                    <p>Any fields that appear to be surrounded by "??" are verses that contained no text in the XX book, i.e. they were overlooked or skipped by the translators. Once they enter the required text, you will need to re-merge per below, "Repeating the Merge Cycle." Whenever you see "OMIT", simply delete it and hide any corresponding information (like the Mile scale) by un-ticking that layer. In the SMP1 collection, removing dots for deliberately missing cities is easy, as there is now a separate InDesign object for each dot.</p>
                    
                    <p>Now is the time - still in preview mode - to make any other cosmetic changes to the map, as needed by the current project.</p>
                    
                    <p>The cosmetic changes in mind are changing the visibility of various layers, changing style attributes, and/or moving text labels. You should not make changes directly to the preview text, not even inserting a line break to wrap long text, as such changes will not be preserved when doing the data merge. Rather, if you need a long label to be wrapped, you should change the dimensions and/or other properties of the text frame and/or paragraph. E.g. Change the text frame's object style to "multiline". (Note that the paragraph's "Balance Ragged Lines" setting, which affects wrapping, is turned on, as inherited from the <code>font1</code> style.) It is recommended that you keep the data merge panel open so that InDesign will prevent you from mistakingly editing the preview text. Unless the data merge panel is open, the document will behave just like an already-merged document, with editable labels. (It will be possible AFTER step 6 in Repeating the Merge Cycle to edit the text and preserve the change, but it is hoped that little of that will be needed.)</p>
                    
                    <p>Note that we have found that it is NOT necessary to actually use the Merge button and create a second, merged InDesign file at this point. If you save and export to jpg or to pdf with Preview mode turned on, the files will be quite usable at this point. We do recommend doing the final merge step and saving that file after you are certain the team will make no more label changes. (See Repeating the Merge Cycle below).</p>
                    
                    <div class="info-card">
                        <img src="images/image_B6.jpg" alt="InDesign Map Preview" style="max-width: 100%; margin: 1rem 0;">
                    </div>
                </div>
                
                <div class="info-card">
                    <h3>Saving your InDesign map file</h3>
                    
                    <p>Save the map in the project \\local\\figures directory e.g. as above: <code>luctest_155wbt - Holy Land.indd</code></p>
                    
                    <p>Export your file as a *.jpg file at this time also and use this file to insert \\fig information into the Paratext Project at the appropriate locations. If you have editing privileges to the project, you can do this yourself or else share it with the team for them to do so.</p>
                    
                    <p>Now you should have two map files in your project IDENTICALLY NAMED except for their extensions. First - a master copy file (.indd) containing all your edits and the original merge keys, which you will re-use for subsequent merges. Second, a (.jpg) file placed into the Paratext project.</p>
                </div>
                
                <div class="info-card">
                    <h3>Repeating the Merge Cycle</h3>
                    
                    <p>After each round of team proofing, there will typically be text and spelling changes the need to be re-merged into the project maps:</p>
                    
                    <ol>
                        <li>Re-export the data merge files.</li>
                        <li>For each affected map, open the master file copy (.indd) and "Update data source" on the Merge Tool menu.</li>
                        <li>Save each revised map according to "Export Map Merge Files", replacing the previous vernacular (.indd) file.</li>
                        <li>When the team has fully approved the maps and no more map label changes are expected, you can complete the final step of "Merging" the document and creating a second InDesign file with the labels actually embedded in the file.</li>
                        <li>Choose "Create Merged Document" from either the Panel Menu or the "Merge Data" icon located just below the Panel Options icon.</li>
                        <li>The Create Merged Document dialogue box will open. The default settings will suffice; click OK when prompted. Note: While performing the Merge task, your merged data will appear to revert back to the generic data fields, but it is still there. Once the Data Merge is completed, a new InDesign file with a "-1" added to the name will be generated. <strong>We recommend your saving this file as an .idml file and removing the -1</strong>. That way the files are identically named and you have not overwritten your mergeable .indd file. The merged .idml file will preserve the data more safely for long term archiving.</li>
                    </ol>
                </div>
                
                <div class="info-card">
                    <h3>Bringing an InDesign map into Scripture Publications</h3>
                    
                    <ol>
                        <li>InDesign maps (.indd files) should be placed directly into InDesign Scripture documents. Publishing Assistant should automatically place any map which has been formatted in Paratext using the \\fig markup and is located in the Paratext project's local/figures folder. Occasionally, you may still see the jpg being placed instead of your .indd. The best way to fix this is to ascertain the exact location of the \\fig markup in Paratext and go to that location in the InDesign file. Edit the fig markup and change the filename to have the .indd extension. In PA6 jobs, you can find it using the Text Editor (ctrl-y). In PA7 jobs, figure markup is found in the Conditional Text Panel Menu. Make the "Hidden Illustration" text visible by clicking in the first column on that line, edit the markup, and turn off visibility again. In both cases, carefully verify that the hidden attributes apply to your new edits. Then use PubAssist to place the picture again.</li>
                        <li>When maps are placed directly in the Scripture text, they should have the title layer turned off and the title should be included instead in the caption and reference sections of the Paratext markup as appropriate. Revisit all the maps after final validation to make sure they (and the gutter rule) still look ok.</li>
                        <li>You may export the merged map to the jpg and PDF formats after final validation. The PDF is useful for archiving.</li>
                        <li>When archiving the final publication files, make sure to archive the local/figures folder as well.</li>
                    </ol>
                </div>
            </div>
        `;
    }

    getMapCreatorMapsPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Working with Map Creator Maps</h1>
                <p class="page-subtitle">Complete guide for working with MAPX files</p>
            </div>
            
            <div class="content-section">
                <div class="info-card">
                    <h3>Create the localized Map Creator file</h3>
                    
                    <ol>
                        <li>Find the appropriate downloaded .mapx file for the map(s) you wish to prepare.</li>
                        <li>Copy the file to the project's \\local\\figures folder. We recommend following the naming convention of the generated merge files. If the original was named e.g. <code>245wbt -Seven Churches.mapx</code>, and your Paratext project was e.g. <code>Zezi</code>, your map file would be <code>245wbt - Seven Churches @Zezi.mapx</code>.</li>
                        <li>Open the .mapx file with Map Creator.</li>
                        <li>Go to File > Import > Translation Data. Browse to the .txt file that was exported from the Paratext Diagram Labeler.</li>
                    </ol>
                    
                    <div class="info-card">
                        <img src="images/image_B8.png" alt="Map Creator Import Process" style="max-width: 100%; margin: 1rem 0;">
                    </div>
                    
                    <ol start="5">
                        <li>On the "Ready to import translations" just click Finish.</li>
                        <li>If all goes well, you will see "Import complete." The import process does, however, show conflicts with any previously imported translations for your project language. These will have to be resolved in consultation with your team.</li>
                        <li>Finalize your translated map.
                            <ol>
                                <li>Don't be surprised that your map will look exactly the same after the import! Go to the Language drop down under Map Options and choose your project language. Only then will your translated map appear.</li>
                            </ol>
                        </li>
                    </ol>
                    
                    <div style="display: flex; align-items: flex-start; margin: 1rem 0;">
                        <img src="images/image_B7.png" alt="Map Creator Language Selection" style="max-width: 250px; margin-right: 1rem;">
                        <div>
                            <ol start="2" style="list-style-type: lower-alpha;">
                                <li>Adjust location and other properties of text fields. There are many options! (Typesetters unfamiliar with Map Creator can profit from an excellent tutorial video <a href="https://vimeo.com/59357958">here</a>. For excellent support, email <a href="mailto:help@fmosoft.org">help@fmosoft.org</a>.) Any fields still displaying English within parentheses indicate missing translations, i.e. a blank verse in the corresponding Paratext XX Book chapter. (Note: It could also indicate a mismatch between the English name expected on the map and the English name in the translation data file, in which case, please report it to <a href="mailto:maps-illustrationsrepository_intl@sil.org">maps-illustrationsrepository_intl@sil.org</a>.)</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <img src="images/image_B4.png" alt="Map Creator Adjustments" style="max-width: 100%; margin: 1rem 0;">
                    </div>
                    
                    <ol start="3" style="list-style-type: lower-alpha;">
                        <li>For any label that says "OMIT" or contains only dashes, select it and uncheck the "Visible" checkbox. This should hide both the label and any associated city dot.</li>
                    </ol>
                </div>
                
                <div class="info-card">
                    <h3>Bringing a Map Creator map into a Scripture publication</h3>
                    
                    <ol>
                        <li>PDFs and jpegs can be created in Map Creator via File > Export</li>
                        <li>PDFs of Map Creator maps should be placed directly into InDesign Scripture documents. Publishing Assistant should automatically place any map which has been formatted in Paratext using the \\fig markup and is located in the Paratext project's local/figures folder. Occasionally, you may still see the jpg being placed instead of your .pdf. The best way to fix this is to use the Text Editor in InDesign (ctrl-y) to edit the fig markup and change the filename to have the .pdf extension. Then use PubAssist to place the picture again.</li>
                        <li>When pictures are placed directly in the Scripture text, they should have the title field turned off (un-tick visible) and the title should be included instead in the caption and reference sections of the Paratext markup as appropriate. Revisit all the maps after final validation to make sure they (and the gutter rule) still look ok.</li>
                    </ol>
                </div>
                
                <div class="info-card">
                    <h3>More about Map Creator</h3>
                    
                    <div class="content-section">
                        <ul>
                            <li><strong>Home Page:</strong> <a href="https://fmosoft.com/map-creator">https://fmosoft.com/map-creator</a></li>
                            <li><strong>Intro Video:</strong> <a href="https://vimeo.com/59357958">https://vimeo.com/59357958</a></li>
                            <li><strong>Support:</strong> <a href="mailto:help@fmosoft.com">help@fmosoft.com</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getFeedbackPage() {
        return `
            <div class="page-header">
                <h1 class="page-title">Feedback & Support</h1>
                <p class="page-subtitle">Get help and share your feedback</p>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Beta Testing Program</h2>
                <div class="info-card">
                    <h3>Join the Beta Program</h3>
                    <p>Stay updated on the latest developments and get support from other beta testers:</p>
                    <a href="mailto:labeler+subscribe@groups.sall.com" class="btn">Join Beta Mailing List</a>
                    <p class="mt-2"><em>Click the confirm link in the email you receive to complete your subscription.</em></p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Feedback Form</h2>
                <div class="info-card">
                    <h3>Share Your Experience</h3>
                    <p>Thank you for your willingness to beta test this software. After installing and using this software, 
                    please complete our feedback form:</p>
                    
                    <a href="https://forms.gle/fVa6qjrsnx3k1ir17" class="btn">Complete Feedback Form</a>
                    
                    <div class="mt-3">
                        <h4>What to Include:</h4>
                        <ul>
                            <li>Things you particularly appreciate</li>
                            <li>Problems you encountered</li>
                            <li>Enhancements you'd like to see in the final Paratext 10 version</li>
                            <li>Suggestions for improving this documentation</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Report Issues</h2>
                <div class="info-card">
                    <h3>GitHub Issues</h3>
                    <p>Found a bug or have a feature request? Report it on GitHub:</p>
                    <a href="https://github.com/sillsdev/paratext-diagram-labeler/issues" class="btn btn-outline">Report Issue</a>
                    
                    <div class="mt-3">
                        <h4>Before Reporting:</h4>
                        <ul>
                            <li>Check if the issue has already been reported</li>
                            <li>Include your operating system and software version</li>
                            <li>Provide steps to reproduce the issue</li>
                            <li>Include any error messages or screenshots</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Migrating from Scripture Map Labeler</h2>
                <div class="info-card">
                    <h3>Existing Users</h3>
                    <p>If you've created maps with the current version of Scripture Map Labeler, those labels will be 
                    accessible in Paratext Diagram Labeler if you ensured your labels were copied into the term renderings.</p>
                    
                    <p>If you haven't done that, the easiest way is to use the 
                    <a href="https://tiny.cc/maplabelerhelper">Map Labeler Helper's</a> "Commit Labels" tool.</p>
                </div>
            </div>
            
            <div class="content-section">
                <h2 class="section-title">Contact Information</h2>
                <div class="info-card">
                    <h3>SIL Global</h3>
                    <p>This software is developed by SIL Global as part of the Paratext ecosystem.</p>

                    <ul>
                        <li><strong>Beta Program:</strong> <a href="mailto:labeler+subscribe@groups.sall.com">labeler+subscribe@groups.sall.com</a></li>
                        <li><strong>GitHub:</strong> <a href="https://github.com/sillsdev/paratext-diagram-labeler">sillsdev/paratext-diagram-labeler</a></li>
                        <li><strong>Feedback Form:</strong> <a href="https://forms.gle/fVa6qjrsnx3k1ir17">Beta Testing Feedback</a></li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Initialize the site when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SiteManager();
});