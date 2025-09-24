<?php
class ModelAccountReferpoints extends Model {
    public function getReferredBuyers($customer_id) {
        // Get all referral_ids for this customer
        $referrals = $this->db->query("SELECT referral_id FROM " . DB_PREFIX . "ipoffer_referral_customers WHERE customer_id = '" . (int)$customer_id . "'");
        $referral_ids = [];
        foreach ($referrals->rows as $row) {
            $referral_ids[] = (int)$row['referral_id'];
        }
        if (empty($referral_ids)) {
            return [];
        }
        $referral_ids_str = implode(',', $referral_ids);
        // Get referral percentage
        $offer = $this->db->query("SELECT percentage FROM " . DB_PREFIX . "ipoffer WHERE offer_type = 'referral' AND status = 1 ORDER BY date_added DESC LIMIT 1");
        $percentage = ($offer->num_rows) ? (float)$offer->row['percentage'] : 0;
        $sql = "SELECT o.order_id, o.date_added AS date, c.firstname, c.lastname, c.email, op.product_id, op.name AS product_name, op.price, op.quantity
                FROM " . DB_PREFIX . "order o
                LEFT JOIN " . DB_PREFIX . "customer c ON o.customer_id = c.customer_id
                LEFT JOIN " . DB_PREFIX . "order_product op ON o.order_id = op.order_id
                WHERE o.referral_id IN ($referral_ids_str) ORDER BY o.order_id DESC, op.product_id ASC";
        $query = $this->db->query($sql);
        $status_map = [5 => 'Completed', 1 => 'Pending', 7 => 'Canceled'];
        $buyers = [];
        foreach ($query->rows as $row) {
            // Fetch latest order_status_id from order_history
            $history = $this->db->query("SELECT order_status_id FROM " . DB_PREFIX . "order_history WHERE order_id = '" . (int)$row['order_id'] . "' ORDER BY date_added DESC, order_history_id DESC LIMIT 1");
            $order_status_id = $history->num_rows ? (int)$history->row['order_status_id'] : 0;
            $status = isset($status_map[$order_status_id]) ? $status_map[$order_status_id] : 'Other';
            $earn = ($order_status_id == 5) ? round($row['price'] * $percentage / 100) : 0;
            $buyers[] = [
                'customer_name' => $row['firstname'] . ' ' . $row['lastname'],
                'email' => $row['email'],
                'product_name' => $row['product_name'],
                'price' => $row['price'],
                'date' => $row['date'],
                'quantity' => $row['quantity'],
                'status' => $status,
                'earn' => $earn,
            ];
        }
        return $buyers;
    }
}