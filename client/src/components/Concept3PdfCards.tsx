import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register emoji source so React-PDF replaces emojis with remote images seamlessly
Font.registerEmojiSource({
  format: 'png',
  url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
});

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  card: {
    position: 'absolute',
    width: '58.3mm',
    height: '89.6mm',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0f172a', // deep slate
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '15mm',
    backgroundColor: '#0f172a', // deep slate
    borderBottomWidth: 3,
    borderBottomColor: '#facc15', // brand yellow stripe
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '6.6mm',
    height: '6.6mm',
  },
  wordmark: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'black',
    marginLeft: '2mm',
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: '5mm',
    paddingHorizontal: '2mm',
  },
  username: {
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: '0mm',
  },
  classNameText: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qrWrapper: {
    marginTop: '6mm',
    padding: '2mm',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  qrCode: {
    width: '32mm',
    height: '32mm',
  },
  recoveryCode: {
    marginTop: '6mm',
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'Courier',
    letterSpacing: 1.5, // Reduced to prevent wrapping
    textAlign: 'center',
    fontWeight: 'bold',
  },
  url: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 'auto', // Pushes URL to the very bottom
    marginBottom: '3mm',
    textAlign: 'center',
    letterSpacing: 0.5,
  }
});

const LOGO_CELLS = [
  '#5dd23c', '#5dd23c', '#fbba00',
  '#5dd23c', '#fbba00', '#4fa7ff',
  '#4fa7ff', '#e8391d', '#dcdcdc',
];

export interface CardData {
  username: string;
  code: string;
  qrDataUrl: string;
}

interface Props {
  cards: CardData[];
  classroomName: string;
  origin: string;
}

export function Concept3PdfCards({ cards, classroomName, origin }: Props) {
  // Chunk into 9 cards per A4 page
  const chunks: CardData[][] = [];
  for (let i = 0; i < cards.length; i += 9) {
    chunks.push(cards.slice(i, i + 9));
  }

  const CARD_W = 58.3;
  const CARD_H = 89.6;
  const MARGIN = 8;
  const GAP = 5;

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {chunk.map((card, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const left = MARGIN + col * (CARD_W + GAP);
            const top = MARGIN + row * (CARD_H + GAP);

            return (
              <View key={card.code} style={{ ...styles.card, left: `${left}mm`, top: `${top}mm` }}>
                
                {/* Header Block */}
                <View style={styles.header}>
                  <View style={styles.logoContainer}>
                    {LOGO_CELLS.map((color, cIdx) => (
                      <View key={cIdx} style={{
                        width: '2mm', height: '2mm', backgroundColor: color, borderRadius: 1, 
                        marginRight: (cIdx % 3 === 2) ? 0 : '0.3mm',
                        marginBottom: (cIdx >= 6) ? 0 : '0.3mm'
                      }} />
                    ))}
                  </View>
                  <Text style={styles.wordmark}>1UP</Text>
                </View>

                {/* Main Content */}
                <View style={styles.body}>
                  <Text style={styles.username}>{card.username}</Text>
                  
                  <Text style={styles.classNameText}>{classroomName}</Text>
                  
                  <View style={styles.qrWrapper}>
                    <Image src={card.qrDataUrl} style={styles.qrCode} />
                  </View>
                  
                  <Text style={styles.recoveryCode}>{card.code}</Text>
                  
                  <Text style={styles.url}>{origin}</Text>
                </View>

              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}
