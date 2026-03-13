# Technical Specification: Direct-to-Mood Marketing Studio

## System Architecture

### High-Level Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Landing   │  │  Campaign  │  │   Asset Components   │  │
│  │    Page    │  │   Board    │  │  (Text/Image/Video)  │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │  State Mgmt     │  │  Form Handler   │  │  Clipboard │  │
│  │  (React State)  │  │  Validation     │  │  Manager   │  │
│  └─────────────────┘  └─────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Ready)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Gemini API Integration Point               ││
│  │  • Model: gemini-3.1-flash-preview                      ││
│  │  • Response Schema: Structured JSON                     ││
│  │  • System Instructions: Creative Director Persona       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. App Component (Root)
**Purpose**: Main application controller

**State Management**:
```javascript
- view: 'landing' | 'campaign'
- businessInfo: string (user input)
- mood: string (selected mood)
- campaign: CampaignObject | null
- loading: boolean
```

**Key Functions**:
- `handleGenerate()`: Orchestrates campaign generation
- View routing between landing and campaign board

### 2. LandingPage Component
**Purpose**: User input and campaign configuration

**Features**:
- Business description textarea (required field)
- Mood selector grid (6 options)
- Form validation
- Loading state visualization
- Animated hero section

**Interactions**:
- Real-time validation
- Mood toggle selection
- Submit triggers API call
- Disabled state during loading

### 3. CampaignBoard Component
**Purpose**: Display generated campaign assets

**Features**:
- Campaign title header
- Asset flow visualization
- Individual asset cards
- Export functionality
- Navigation back to form

**Data Flow**:
- Receives campaign object from parent
- Maps assets to AssetCard components
- Provides bulk export capability

### 4. AssetCard Component
**Purpose**: Individual asset display with interactions

**Props**:
```javascript
{
  asset: {
    type: 'text' | 'image_prompt' | 'video_prompt',
    content: string,
    styling_notes: string
  },
  index: number
}
```

**Features**:
- Type-specific icons and tags
- Copy-to-clipboard functionality
- Staggered animation entrance
- Hover effects
- Responsive layout

## Design System

### Color Palette
```css
Primary Gradient: 
  linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)

Background:
  linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2a1f3a 100%)

Glass Effect:
  background: rgba(255, 255, 255, 0.05)
  backdrop-filter: blur(20px)
  border: 1px solid rgba(255, 255, 255, 0.1)

Tag Colors:
  Text: linear-gradient(135deg, #ffd89b 0%, #19547b 100%)
  Image: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)
  Video: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)
```

### Typography Scale
```css
Hero Title: 5xl-7xl (3rem-4.5rem)
Section Headers: 2xl-3xl (1.5rem-1.875rem)
Body Text: base-lg (1rem-1.125rem)
Small Text: sm (0.875rem)
Tags: xs (0.75rem)

Fonts:
  Primary: 'Outfit' (weights: 300-900)
  Accent: 'Crimson Pro' (weights: 400, 600, 700)
```

### Spacing System
```css
Base unit: 0.25rem (4px)

Scale:
  xs: 0.5rem (8px)
  sm: 0.75rem (12px)
  md: 1rem (16px)
  lg: 1.5rem (24px)
  xl: 2rem (32px)
  2xl: 3rem (48px)
  3xl: 4rem (64px)
```

### Animation Specifications

#### FadeInUp
```css
Duration: 0.6s
Easing: ease-out
Transform: translateY(30px) → translateY(0)
Opacity: 0 → 1
Stagger Delay: 0.15s per item
```

#### Float (Hero Element)
```css
Duration: 6s
Easing: ease-in-out
Transform: translateY(0px) ↔ translateY(-20px)
Loop: infinite
```

#### Button Hover
```css
Transform: translateY(-2px)
Shadow: 0 10px 30px rgba(102, 126, 234, 0.5)
Transition: 0.3s ease
```

#### Shimmer Effect
```css
Linear gradient sweep across button
Duration: 0.5s
Triggered on hover
```

## API Integration Details

### Gemini Configuration

#### System Instruction
```javascript
const systemInstruction = `
You are a Senior Creative Director. Your output must always be a 
structured JSON array representing a 'Campaign Flow'. Each element 
must be an 'Asset' containing:

- type: (text, image_prompt, or video_prompt)
- content: The actual marketing copy or highly detailed prompt
- styling_notes: Brief explanation of brand mood fit

Generate campaigns that maintain visual and tonal cohesion across 
all assets. Image and video prompts should reference lighting, 
colors, and mood established in text assets.
`;
```

#### Response Schema
```javascript
{
  type: "object",
  properties: {
    campaign_title: { type: "string" },
    assets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["text", "image_prompt", "video_prompt"] 
          },
          content: { type: "string" },
          styling_notes: { type: "string" }
        },
        required: ["type", "content", "styling_notes"]
      }
    }
  },
  required: ["campaign_title", "assets"]
}
```

#### Prompt Template
```javascript
const constructPrompt = (businessInfo, mood) => `
Generate a 4-part interleaved marketing sequence for: ${businessInfo}.

The sequence should follow this mood: ${mood}.

Structure the sequence as follows:
1. Hook (Text) - Opening statement that captures attention
2. Hero Visual (Image Prompt) - Detailed photography/design prompt
3. Storytelling/Value Prop (Text) - Narrative that builds connection
4. Call to Action (Video Prompt) - Dynamic video advertisement prompt

Ensure visual prompts (image/video) explicitly reference brand colors 
and lighting styles established in the text assets. Create a cohesive 
${mood} atmosphere across all elements.
`;
```

## State Management Flow

### Campaign Generation Sequence
```
1. User fills form (businessInfo + mood)
   ↓
2. Validation check
   ↓
3. setLoading(true)
   ↓
4. API call to generateCampaign()
   ↓
5. Receive structured JSON response
   ↓
6. setCampaign(result)
   ↓
7. setView('campaign')
   ↓
8. setLoading(false)
   ↓
9. AssetCards render with staggered animations
```

### Error Handling
```javascript
try {
  const result = await generateCampaign(businessInfo, mood);
  setCampaign(result);
  setView('campaign');
} catch (error) {
  console.error('Error generating campaign:', error);
  // User-friendly error message
  alert('Failed to generate campaign. Please try again.');
} finally {
  setLoading(false);
}
```

## Responsive Design Specifications

### Mobile (< 768px)
- Single column layout
- Stacked mood selector (1 column)
- Reduced padding (1rem)
- Larger touch targets (minimum 44px)
- Font size scaling down
- Simplified animations (reduced motion)

### Tablet (768px - 1024px)
- Two column mood selector
- Moderate padding (1.5rem)
- Full animations enabled
- Optimized image sizes

### Desktop (> 1024px)
- Three column mood selector
- Maximum padding (3rem)
- Full feature set
- Enhanced hover effects
- Parallax effects enabled

## Performance Optimizations

### Bundle Size
- Single HTML file: ~20KB
- External dependencies (CDN):
  - React: 32KB (gzipped)
  - React DOM: 10KB (gzipped)
  - Babel Standalone: 185KB (gzipped)
  - Tailwind: Minimal (JIT)
  - Google Fonts: ~40KB

Total Page Weight: ~287KB

### Rendering Performance
- Virtual DOM optimizations via React
- CSS animations (GPU accelerated)
- Minimal JavaScript execution
- Lazy loading for assets
- Efficient re-renders (React memo potential)

### Network Optimization
- CDN-hosted dependencies
- Font preconnection
- Minimal HTTP requests
- Compressed assets

## Security Considerations

### Input Validation
```javascript
// Sanitize user input before API call
const sanitizeInput = (input) => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};
```

### API Security
- API keys should be environment variables
- CORS configuration for production
- Rate limiting on API calls
- Input length restrictions

## Testing Specifications

### Unit Tests (Recommended)
- Form validation logic
- State management functions
- Asset card rendering
- Copy to clipboard functionality

### Integration Tests
- Form submission flow
- API response handling
- View navigation
- Error states

### E2E Tests
- Complete user journey
- Cross-browser compatibility
- Mobile device testing
- Performance benchmarks

## Deployment Checklist

### Pre-Deployment
- [ ] Replace mock API with real Gemini integration
- [ ] Add environment variables for API keys
- [ ] Test on multiple browsers
- [ ] Validate mobile responsiveness
- [ ] Run performance audit
- [ ] Check accessibility (WCAG AA)
- [ ] Optimize images and assets
- [ ] Configure CORS if needed

### Deployment Steps
1. Build production version
2. Configure hosting platform
3. Set environment variables
4. Deploy to staging
5. Run QA tests
6. Deploy to production
7. Monitor analytics

### Post-Deployment
- [ ] Monitor error logs
- [ ] Track generation success rate
- [ ] Gather user feedback
- [ ] A/B test mood options
- [ ] Optimize based on usage patterns

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari 14+
- Chrome Mobile 90+

### Fallbacks
- CSS Grid → Flexbox
- backdrop-filter → solid background
- Custom fonts → system fonts

## Future Enhancements

### Phase 2 Features
- User accounts and saved campaigns
- Campaign history
- Direct image generation integration
- Video preview capability
- Team collaboration features
- Template library
- Brand kit storage

### Advanced Features
- A/B testing variants
- Multi-language support
- Advanced analytics
- Export to various formats (PDF, JSON, CSV)
- API for third-party integrations
- White-label capability

## Code Quality Standards

### JavaScript
- ES6+ syntax
- Functional components
- Hooks for state management
- Clear variable naming
- Commented complex logic
- Error handling on all async operations

### CSS
- BEM naming convention potential
- Utility-first with Tailwind
- Custom properties for theming
- Responsive units (rem, %, vw/vh)
- Mobile-first media queries

### Accessibility
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Focus indicators
- Color contrast ratios
- Screen reader support

## Monitoring and Analytics

### Key Metrics to Track
- Campaign generation success rate
- Average generation time
- Most popular mood selections
- User drop-off points
- Error frequency
- Browser/device distribution
- Asset copy rates

### Performance Metrics
- Page load time
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

---

**Document Version**: 1.0  
**Last Updated**: March 2026  
**Status**: Production Ready (with API integration)
