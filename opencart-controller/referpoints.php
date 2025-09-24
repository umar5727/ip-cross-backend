<?php
class ControllerAccountReferpoints extends Controller {
    public function index() {
        if (!$this->customer->isLogged()) {
            $this->session->data['redirect'] = $this->url->link('account/referpoints', '', true);
            $this->response->redirect($this->url->link('account/login', '', true));
        }

        $this->load->language('account/referpoints');
        $this->document->setTitle('Referred Buyers');
        $this->load->model('account/referpoints');

        $data['referred_buyers'] = $this->model_account_referpoints->getReferredBuyers($this->customer->getId());

        $data['breadcrumbs'] = array();
        $data['breadcrumbs'][] = array(
            'text' => $this->language->get('text_home'),
            'href' => $this->url->link('common/home')
        );
        $data['breadcrumbs'][] = array(
            'text' => 'Refer Points',
            'href' => $this->url->link('account/referpoints', '', true)
        );

        $data['heading_title'] = 'Referred Buyers';
        $data['text_no_results'] = 'No buyers found for this referral.';

        $data['column_order_id'] = 'Order ID';
        $data['column_date'] = 'Date';
        $data['column_customer_name'] = 'Customer Name';
        $data['column_email'] = 'Email';
        $data['column_product_id'] = 'Product ID';
        $data['column_product_name'] = 'Product Name';
        $data['column_price'] = 'Price';
        $data['column_quantity'] = 'Quantity';
        $data['column_status'] = 'Status';
        $data['column_earn'] = 'Earn';

        $data['back'] = $this->url->link('account/account', '', true);
        $data['continue'] = $this->url->link('account/account', '', true);

        $data['header'] = $this->load->controller('common/header');
        $data['footer'] = $this->load->controller('common/footer');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['column_right'] = $this->load->controller('common/column_right');
        $data['content_top'] = $this->load->controller('common/content_top');
        $data['content_bottom'] = $this->load->controller('common/content_bottom');
        $data['column_left_account'] = $this->load->controller('account/column_left_account');
        $this->response->setOutput($this->load->view('account/referpoints', $data));
    }
}