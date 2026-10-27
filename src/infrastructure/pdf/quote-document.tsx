import {
  Document,
  Font,
  Page,
  Path,
  StyleSheet,
  Svg,
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
  ink: "#000000",
  muted: "#706F6F",
  accent: "#FFCE13",
  line: "#D8D8D5",
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

const lockupPaths = [
  [
    "M 0 0 L 0 -5 L 1.353 -5 C 2.033 -5 2.611 -4.759 3.086 -4.275 C 3.562 -3.792 3.799 -3.2 3.799 -2.5 C 3.799 -1.801 3.562 -1.209 3.086 -0.726 C 2.611 -0.242 2.033 0 1.353 0 Z M 1.353 1.001 C 2.326 1.001 3.161 0.655 3.857 -0.034 C 4.555 -0.725 4.902 -1.547 4.902 -2.5 C 4.902 -3.454 4.555 -4.276 3.857 -4.966 C 3.161 -5.656 2.326 -6.001 1.353 -6.001 L -1.099 -6.001 L -1.099 1.001 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 236.33970945656685 320.61304032103993)",
  ],
  [
    "M 0 0 L 0 -1.001 L -5.049 -1.001 L -5.049 6.001 L -0.098 6.001 L -0.098 5 L -3.95 5 L -3.95 3.149 L -0.898 3.149 L -0.898 2.148 L -3.95 2.148 L -3.95 0 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 251.28770983390027 325.6130308526361)",
  ],
  [
    "M 0 0 L 0 -1.001 L -2.1 -1.001 L -2.1 -7.002 L -3.198 -7.002 L -3.198 -1.001 L -5.298 -1.001 L -5.298 0 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 260.68301203952063 319.61200461902934)",
  ],
  [
    "M 0 0 L 2.3 0 L 1.152 2.9 Z M 0.601 4.15 L 1.699 4.15 L 4.6 -2.852 L 3.452 -2.852 L 2.7 -1.001 L -0.4 -1.001 L -1.152 -2.852 L -2.3 -2.852 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 266.1829006122067 323.7623873845144)",
  ],
  [
    "M 275.389 550.623 L 276.488 550.623 L 276.488 543.621 L 275.389 543.621 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 0 870.234375)",
  ],
  [
    "M 0 0 L 0 7.002 L 1.099 7.002 L 1.099 1.001 L 4.497 1.001 L 4.497 0 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 281.8789021925159 326.6138834495247)",
  ],
  [
    "M 0 0 L 0 -5.476 L -14.766 -5.476 L -14.766 -11.742 L -3.242 -11.742 L -3.242 -17.218 L -14.766 -17.218 L -14.766 -28.347 L -20.855 -28.347 L -20.855 0 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 256.09652659221774 284.0915030359911)",
  ],
  [
    "M 0 0 L 0 -5.456 L -21.27 -5.456 L -21.27 22.891 L -0.415 22.891 L -0.415 17.415 L -15.182 17.415 L -15.182 11.742 L -3.657 11.742 L -3.657 6.286 L -15.182 6.286 L -15.182 0 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 283.0090672837405 306.9823288286175)",
  ],
  [
    "M 0 0 C -0.731 0.724 -1.651 1.087 -2.758 1.087 L -9.024 1.087 L -9.024 -6.405 L -2.758 -6.405 C -1.651 -6.405 -0.731 -6.053 0 -5.347 C 0.731 -4.642 1.097 -3.776 1.097 -2.748 C 1.097 -1.641 0.731 -0.725 0 0 M -15.112 6.563 L -2.56 6.563 C 0.247 6.563 2.57 5.663 4.408 3.865 C 6.247 2.066 7.166 -0.138 7.166 -2.748 C 7.166 -3.881 6.988 -4.942 6.632 -5.93 C 6.276 -6.919 5.858 -7.716 5.377 -8.322 C 4.896 -8.929 4.405 -9.449 3.904 -9.884 C 3.404 -10.319 2.975 -10.615 2.619 -10.773 L 2.105 -11.05 L 8.174 -21.784 L 1.69 -21.784 L -3.766 -11.861 L -9.024 -11.861 L -9.024 -21.784 L -15.112 -21.784 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 304.15954820047335 290.6543568189551)",
  ],
  [
    "M 0 0 C -0.731 0.724 -1.651 1.087 -2.758 1.087 L -9.024 1.087 L -9.024 -6.405 L -2.758 -6.405 C -1.651 -6.405 -0.731 -6.053 0 -5.347 C 0.731 -4.642 1.097 -3.776 1.097 -2.748 C 1.097 -1.641 0.731 -0.725 0 0 M -15.113 6.563 L -2.56 6.563 C 0.247 6.563 2.57 5.663 4.408 3.865 C 6.247 2.066 7.166 -0.138 7.166 -2.748 C 7.166 -3.881 6.988 -4.942 6.632 -5.93 C 6.276 -6.919 5.857 -7.716 5.377 -8.322 C 4.895 -8.929 4.404 -9.449 3.904 -9.884 C 3.403 -10.319 2.975 -10.615 2.619 -10.773 L 2.105 -11.05 L 8.174 -21.784 L 1.69 -21.784 L -3.766 -11.861 L -9.024 -11.861 L -9.024 -21.784 L -15.113 -21.784 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 333.3068458620877 290.6543568189551)",
  ],
  [
    "M 0 0 L -3.459 -9.311 L 3.44 -9.311 Z M -5.476 -14.569 L -7.907 -21.25 L -14.391 -21.25 L -3.242 7.097 L 3.222 7.097 L 14.371 -21.25 L 7.887 -21.25 L 5.456 -14.569 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 358.4893495825403 291.18804721456394)",
  ],
  [
    "M 0 0 C -0.731 0.724 -1.651 1.087 -2.758 1.087 L -9.024 1.087 L -9.024 -6.405 L -2.758 -6.405 C -1.651 -6.405 -0.731 -6.053 0 -5.347 C 0.731 -4.642 1.097 -3.776 1.097 -2.748 C 1.097 -1.641 0.731 -0.725 0 0 M -15.112 6.563 L -2.56 6.563 C 0.247 6.563 2.57 5.663 4.408 3.865 C 6.247 2.066 7.166 -0.138 7.166 -2.748 C 7.166 -3.881 6.988 -4.942 6.632 -5.93 C 6.276 -6.919 5.857 -7.716 5.377 -8.322 C 4.895 -8.929 4.404 -9.449 3.904 -9.884 C 3.403 -10.319 2.975 -10.615 2.619 -10.773 L 2.105 -11.05 L 8.174 -21.784 L 1.69 -21.784 L -3.766 -11.861 L -9.024 -11.861 L -9.024 -21.784 L -15.112 -21.784 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 392.4099575196823 290.6543568189551)",
  ],
  [
    "M 0 0 C 1.766 -1.793 3.918 -2.688 6.454 -2.688 C 8.991 -2.688 11.143 -1.793 12.908 0 C 14.675 1.792 15.557 3.996 15.557 6.612 C 15.557 9.228 14.675 11.436 12.908 13.234 C 11.143 15.033 8.991 15.933 6.454 15.933 C 3.918 15.933 1.766 15.033 0 13.234 C -1.765 11.436 -2.649 9.228 -2.649 6.612 C -2.649 3.996 -1.765 1.792 0 0 M -4.477 17.06 C -1.505 19.946 2.139 21.389 6.454 21.389 C 10.77 21.389 14.415 19.946 17.386 17.06 C 20.358 14.173 21.843 10.694 21.843 6.622 C 21.843 2.55 20.358 -0.933 17.386 -3.825 C 14.415 -6.718 10.77 -8.164 6.454 -8.164 C 2.139 -8.164 -1.505 -6.718 -4.477 -3.825 C -7.448 -0.933 -8.935 2.55 -8.935 6.622 C -8.935 10.694 -7.448 14.173 -4.477 17.06",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 413.7576085140304 304.8870569174949)",
  ],
  [
    "M 205.117 582.134 L 189.088 582.134 L 189.088 598.163 L 205.117 598.163 Z M 205.117 563.953 L 189.088 563.953 L 189.088 579.982 L 205.117 579.982 Z M 205.117 545.773 L 189.088 545.773 L 189.088 561.801 L 205.117 561.801 Z M 186.937 543.621 L 207.269 543.621 L 207.269 600.314 L 186.937 600.314 Z",
    "matrix(0.9999797404883795 0 0 -0.9999981063192338 0 870.234375)",
  ],
] as const;

function FerraroLockup() {
  return (
    <Svg viewBox="180 260 270 75" style={{ width: 135, height: 38 }}>
      {lockupPaths.map(([d, transform]) => (
        <Path d={d} fill={colors.ink} key={d} transform={transform} />
      ))}
    </Svg>
  );
}
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
    color: "#e7e1d4",
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
            <FerraroLockup />
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
            {brandConfig.businessName} · {brandConfig.location},{" "}
            {brandConfig.country}
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
