import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";

import { brandConfig } from "@/config/brand";

export interface QuotePdfData {
  number: string;
  status: string;
  issuedOn: string;
  validUntil?: string;
  clientName: string;
  vehicle: string;
  notes?: string;
  terms?: string;
  currency: "USD" | "ARS";
  exchangeRateArsPerUsd?: string;
  sourceSubtotal: string;
  sourceDiscount: string;
  sourceTotal: string;
  subtotalUsd: string;
  discountUsd: string;
  totalUsd: string;
  items: {
    name: string;
    description?: string;
    quantity: string;
    unitPriceUsd: string;
    sourceUnitPrice: string;
    discountUsd: string;
    sourceDiscount: string;
    totalUsd: string;
    sourceTotal: string;
  }[];
}

const colors = {
  ink: "#1F2329",
  muted: "#6B7280",
  accent: "#3D5AFE",
  line: "#E5E7EB",
  paper: "#FFFFFF",
};

Font.register({
  family: "Inter",
  fonts: [
    {
      src: path.resolve(
        process.cwd(),
        "src/design-system/fonts/inter-variable.ttf",
      ),
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Inter",
    fontSize: 9,
    padding: "42 44 48",
  },
  topRule: { height: 4, backgroundColor: colors.accent, marginBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  meta: { alignItems: "flex-end", color: colors.muted, lineHeight: 1.5 },
  title: {
    fontWeight: 700,
    fontSize: 31,
    letterSpacing: -1,
    marginBottom: 8,
  },
  lead: { color: colors.muted, fontSize: 10, marginBottom: 24 },
  identity: {
    flexDirection: "row",
    borderTop: `1 solid ${colors.line}`,
    borderBottom: `1 solid ${colors.line}`,
    paddingVertical: 14,
    marginBottom: 22,
  },
  identityCell: { width: "50%" },
  label: {
    color: colors.muted,
    fontWeight: 700,
    fontSize: 6.8,
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  identityValue: { fontWeight: 700, fontSize: 12 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `1 solid ${colors.ink}`,
    paddingBottom: 7,
  },
  row: {
    flexDirection: "row",
    borderBottom: `1 solid ${colors.line}`,
    paddingVertical: 10,
  },
  item: { width: "50%", paddingRight: 12 },
  qty: { width: "10%", textAlign: "right" },
  price: { width: "18%", textAlign: "right" },
  total: { width: "22%", textAlign: "right", fontWeight: 700 },
  itemName: { fontWeight: 700, fontSize: 9.5, marginBottom: 3 },
  itemDescription: { color: colors.muted, fontSize: 8, lineHeight: 1.4 },
  summary: { width: "46%", alignSelf: "flex-end", marginTop: 22 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  grandTotal: {
    borderTop: `1 solid ${colors.ink}`,
    marginTop: 4,
    paddingTop: 10,
    fontWeight: 700,
    fontSize: 15,
  },
  section: { marginTop: 24 },
  body: { color: colors.muted, lineHeight: 1.55 },
  footer: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1 solid ${colors.line}`,
    color: colors.muted,
    fontSize: 7,
    paddingTop: 8,
  },
  watermark: {
    position: "absolute",
    top: "42%",
    left: "18%",
    color: "#e5e7eb",
    fontWeight: 700,
    fontSize: 64,
    letterSpacing: 8,
    transform: "rotate(-24deg)",
  },
});

function money(value: string, currency: "USD" | "ARS") {
  return `${currency} ${value}`;
}

function QuoteDocument({
  data,
  draft,
}: {
  data: QuotePdfData;
  draft: boolean;
}) {
  return (
    <Document
      title={`Presupuesto ${data.number}`}
      author={brandConfig.businessName}
      creator={brandConfig.productName}
      producer={brandConfig.productName}
    >
      <Page size="A4" style={styles.page} wrap>
        {draft ? (
          <Text style={styles.watermark} fixed>
            PREVIEW
          </Text>
        ) : null}
        <View style={styles.topRule} fixed />
        <View style={styles.header}>
          <View>
            {/* Official shield pending; use only the institutional name. */}
            <Text style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>
              {brandConfig.businessName}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text>{data.number}</Text>
            <Text>{data.issuedOn}</Text>
            {data.validUntil ? (
              <Text>Válido hasta {data.validUntil}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.title}>Presupuesto</Text>
        <Text style={styles.lead}>
          Una propuesta cuidada para proteger y realzar cada detalle.
        </Text>
        <View style={styles.identity}>
          <View style={styles.identityCell}>
            <Text style={styles.label}>CLIENTE</Text>
            <Text style={styles.identityValue}>{data.clientName}</Text>
          </View>
          <View style={styles.identityCell}>
            <Text style={styles.label}>VEHÍCULO</Text>
            <Text style={styles.identityValue}>{data.vehicle}</Text>
          </View>
        </View>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.item}>SERVICIO</Text>
          <Text style={styles.qty}>CANT.</Text>
          <Text style={styles.price}>PRECIO</Text>
          <Text style={styles.total}>TOTAL</Text>
        </View>
        {data.items.map((item, index) => (
          <View style={styles.row} key={`${item.name}-${index}`} wrap={false}>
            <View style={styles.item}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDescription}>{item.description}</Text>
              ) : null}
              {item.sourceDiscount !== "0.00" ? (
                <Text style={styles.itemDescription}>
                  Descuento: {money(item.sourceDiscount, data.currency)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Text style={styles.price}>
              {money(item.sourceUnitPrice, data.currency)}
            </Text>
            <Text style={styles.total}>
              {money(item.sourceTotal, data.currency)}
            </Text>
          </View>
        ))}
        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>{money(data.sourceSubtotal, data.currency)}</Text>
          </View>
          {data.sourceDiscount !== "0.00" ? (
            <View style={styles.summaryRow}>
              <Text>Descuento</Text>
              <Text>− {money(data.sourceDiscount, data.currency)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.grandTotal]}>
            <Text>Total</Text>
            <Text>{money(data.sourceTotal, data.currency)}</Text>
          </View>
          {data.currency === "ARS" ? (
            <Text style={styles.body}>
              Cotización aplicada: 1 USD = ARS {data.exchangeRateArsPerUsd}.
              Equivalente canónico: USD {data.totalUsd}.
            </Text>
          ) : null}
        </View>
        {data.notes ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>OBSERVACIONES</Text>
            <Text style={styles.body}>{data.notes}</Text>
          </View>
        ) : null}
        <View style={styles.section} wrap={false}>
          <Text style={styles.label}>CONDICIONES</Text>
          <Text style={styles.body}>
            {data.terms || brandConfig.pdf.defaultTerms}
          </Text>
        </View>
        <View style={styles.footer} fixed>
          <Text>
            {brandConfig.businessName} ·{" "}
            {[brandConfig.location, brandConfig.country]
              .filter(Boolean)
              .join(", ")}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(data: QuotePdfData, draft: boolean) {
  return renderToBuffer(<QuoteDocument data={data} draft={draft} />);
}
