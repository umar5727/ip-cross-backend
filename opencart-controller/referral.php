<?php
class ControllerAccountReferral extends Controller {
    public function index(){
		$data['footer'] = $this->load->controller('common/footer');
		$data['header'] = $this->load->controller('common/header');
        $data['column_left_account'] = $this->load->controller('account/column_left_account');
        
        $this->response->setOutput($this->load->view('account/referral', $data));
    }
    public function form() {
        if (!$this->customer->isLogged()) {
            $this->response->redirect($this->url->link('account/login', '', true));
        }
        $this->load->language('account/account');
        $this->load->model('account/customer');
        $this->load->model('ipoffer/offer');
        // Check if referral offer is enabled
        if (!$this->model_ipoffer_offer->isReferralOfferEnabled()) {
            $data['error_warning'] = 'Referral offer is not valid.';
            $this->response->setOutput($this->load->view('account/referral_form', $data));
            return;
        }
        $customer_info = $this->model_account_customer->getCustomer($this->customer->getId());
        $data['customer_name'] = $customer_info['firstname'] . ' ' . $customer_info['lastname'];
        $data['customer_email'] = $customer_info['email'];
        $data['action'] = $this->url->link('account/referral/submit', '', true);
        $data['product_autocomplete'] = $this->url->link('account/referral/product_autocomplete', '', true);
        
        // Check if customer already has a referral link
        $existing_referral = $this->model_ipoffer_offer->getCustomerReferral($this->customer->getId());
        if ($existing_referral) {
            // Pass the existing referral link to the template
            $data['existing_referral_link'] = $existing_referral['refer_link'];
        }
        
        $this->response->setOutput($this->load->view('account/referral_form', $data));
    }

    public function product_autocomplete() {
        $json = array();
        if (isset($this->request->get['filter_name'])) {
            $this->load->model('catalog/product');
            $filter_data = array(
                'filter_name' => $this->request->get['filter_name'],
                'start'       => 0,
                'limit'       => 10
            );
            $results = $this->model_catalog_product->getProducts($filter_data);
            foreach ($results as $result) {
                $json[] = array(
                    'product_id' => $result['product_id'],
                    'name'       => strip_tags(html_entity_decode($result['name'], ENT_QUOTES, 'UTF-8'))
                );
            }
        }
        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function submit() {
        $json = array();
        try {
            if (!$this->customer->isLogged()) {
                $json['error'] = 'You must be logged in to refer.';
            } else {
                $this->load->model('ipoffer/offer');
                $this->load->model('account/customer');
                $customer_info = $this->model_account_customer->getCustomer($this->customer->getId());
                $customer_id = $this->customer->getId();
                $customer_name = $customer_info['firstname'] . ' ' . $customer_info['lastname'];
                $customer_email = $customer_info['email'];
                
                // Check if customer already has a referral entry
                $existing_referral = $this->model_ipoffer_offer->getCustomerReferral($customer_id);
                
                if ($existing_referral) {
                    // Use existing referral code and link
                    $json['success'] = true;
                    $json['link'] = $existing_referral['refer_link'];
                } else {
                    // Generate or get referral code
                    $referral_code = $this->model_ipoffer_offer->getOrCreateReferralCode($customer_id);
                    // Generate referral link (to home or a landing page, or you can use a default product)
                    $referral_link = $this->url->link('common/home', 'ref=' . $referral_code, true);
                    // Store the generated referral code and link
                    $this->model_ipoffer_offer->addReferralCustomer([
                        'customer_id' => $customer_id,
                        'customer_name' => $customer_name,
                        'customer_email' => $customer_email,
                        'refer_code' => $referral_code,
                        'refer_link' => $referral_link,
                        'status' => 0 // Pending by default
                    ]);
                    $json['success'] = true;
                    $json['link'] = $referral_link;
                }
            }
        } catch (Exception $e) {
            // Log the error
            $this->log->write('Referral error: ' . $e->getMessage());
            $json['error'] = $e->getMessage();
        }
        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }
}